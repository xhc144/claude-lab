using System.Runtime.InteropServices;

namespace SnapTool.Capture;

/// <summary>
/// Appended：接上了新内容；Unchanged：画面没动；Behind：回到了已经截过的位置（往回滚了），没有新内容；
/// Blank：这一帧全是空白，看不出滚到了哪，先不接，等出现内容再接；
/// NoMatch：在已截内容里找不到这一帧（滚过头、中间断了），往回滚到截过的地方就能接着截，实在接不上就跳过；
/// Skipped：跳过了接不上的一段（结果里留了标记），从这一帧接着截。
/// </summary>
public enum StitchResult { Appended, Unchanged, Behind, Blank, NoMatch, Skipped }

/// <summary>
/// 长截图拼接：给每一行算哈希，把新的一帧放到“已拼好的整张图”里找位置（不只跟上一帧比），
/// 所以中间断了以后，只要往回滚到截过的地方，就能自动接上继续截。
/// 顶部、底部不随滚动变化的行（固定导航栏、底栏）会被识别出来，只保留一份。
/// 允许少量行对不上（鼠标悬停高亮、懒加载图片）；动图、视频、闪烁的东西即使占了一大块，
/// 只要对不上的行集中在少数几块里、其余的都对得上，也算接上。
/// 大段空白比截图区域还高时，把空白两头直接连起来（空白可能变短，内容不丢）。
/// 实在接不上可以跳过：结果里画一条标记，从当前画面接着截，后面的照样能接上。
/// </summary>
public sealed class Stitcher
{
    const double MinMatchRatio = 0.8;     // 重叠部分至少这么多行一致才算对上
    const int MinMatches = 5;             // 至少要有这么多“有内容”的行对上
    const double LooseMatchRatio = 0.15;  // 对不上的行集中在少数几块里（动图之类）时，放宽到这么多行一致
    const int LooseMinMatches = 15;
    const int MaxMismatchBlocks = 4;
    const int MaxRepeats = 64;            // 某个行哈希在结果里出现太多次（表格线之类），不拿它投票
    const ulong MarkHash = 0;             // 跳过标记的行：不参与匹配

    readonly int _w, _h;
    readonly int _c0, _c1; // 参与比较的列范围，避开两侧滚动条

    // 已拼好的内容（不含底栏），以及每行的哈希和索引
    readonly List<byte[]> _rows = [];
    readonly List<ulong> _hash = [];
    readonly List<bool> _flat = [];
    readonly Dictionary<ulong, List<int>> _index = [];
    byte[][] _footer = [];

    ulong[] _prevHash; // 上一次抓到的帧（不论是否接上），用来判断画面有没有动、识别固定栏
    ulong[] _atHash;   // 最近一次定位到的帧（_pos 那一帧），用来判断页面是不是根本没动
    bool[] _atFlat;
    StitchResult _prevResult = StitchResult.Unchanged;
    int _top, _bottom; // 识别出的固定顶栏 / 底栏高度
    bool _appended;
    int _pos; // 最近一次定位到的帧：帧的第 i 行 = 结果的第 _pos + i 行
    int? _prevAt; // 上一次抓到的帧的位置（没定位到为 null），用来判断两帧之间页面有没有动
    bool _lost; // 断了还没重新接上：这时不按空白自动连接，免得把漏掉的内容悄悄吞掉

    public int Width => _w;
    public int Height => _rows.Count + _footer.Length;
    /// <summary>最近一次定位相对前一次往下移动了多少行（往回滚为负）。</summary>
    public int LastShift { get; private set; }
    /// <summary>参与匹配的区域高度（去掉固定栏）。</summary>
    public int ContentHeight => _h - _top - _bottom;
    /// <summary>最近一次不是按画面内容对上的（空白里按估算接、跳过），LastShift 不能当真。</summary>
    public bool Estimated { get; private set; }
    /// <summary>跳过了几处。</summary>
    public int Skips { get; private set; }
    /// <summary>测试用：最近一次定位的候选位置和核对结果。</summary>
    public string LastDebug { get; private set; } = "";

    public Stitcher(RawImage first)
    {
        _w = first.Width;
        _h = first.Height;
        // 两侧各留一条不参与比较：滚动条（高缩放下很宽，鼠标停上去还会变宽变色）、窗口边框
        int margin = Math.Min(_w / 8, Math.Clamp(_w / 20, 24, 80));
        _c0 = margin;
        _c1 = _w - margin;
        var (hash, flat) = HashRows(first);
        _prevHash = _atHash = hash;
        _atFlat = flat;
        _prevAt = 0;
        for (int y = 0; y < _h; y++) AddRow(CopyRow(first, y), hash[y], flat[y]);
    }

    /// <param name="expectedShift">
    /// 预计页面从上次定位到现在往下移了多少行（自动滚动时按滚轮刻度估算）。只在中间全是空白、
    /// 从画面上看不出滚了多少时才会用它来接（误差只影响空白的长短）。
    /// </param>
    public StitchResult Add(RawImage f, int? expectedShift = null)
    {
        if (f.Width != _w || f.Height != _h) return StitchResult.NoMatch;
        var (hash, flat) = HashRows(f);
        if (hash.AsSpan().SequenceEqual(_prevHash))
            return _prevResult is StitchResult.NoMatch or StitchResult.Blank ? _prevResult : StitchResult.Unchanged;
        // 先按已经识别出的固定栏找位置，找不到再把这一帧里看上去像固定栏的部分也去掉试试
        var (barTop, barBottom) = FixedBars(hash, flat);
        int target = _pos + (expectedShift ?? 0);
        int p = Locate(hash, flat, _top, _h - _bottom, target);
        if (p == int.MinValue && (barTop > _top || barBottom > _bottom))
            p = Locate(hash, flat, Math.Max(_top, barTop), _h - Math.Max(_bottom, barBottom), target);
        // 跟上一帧比页面确实动了，上下没变的行才是固定栏；
        // 页面没动、只有动图在变时，上下大片都相同，说明不了什么
        if (p != int.MinValue && _prevAt is int at && p != at)
        {
            _top = Math.Max(_top, barTop);
            _bottom = Math.Max(_bottom, barBottom);
        }
        var prev = _prevHash;
        _prevHash = hash;
        SplitFooter();

        int top = _top, end = _h - _bottom;
        Estimated = false;
        bool still = p == int.MinValue && !AllFlat(flat, top, end) && Still(hash, flat, top, end);
        if (still) p = _pos;
        if (p == int.MinValue)
        {
            p = JoinBlank(hash, flat, prev, top, end, expectedShift, out bool wait);
            if (p == int.MinValue)
            {
                _prevAt = null;
                bool blank = wait || AllFlat(flat, top, end);
                if (!blank) _lost = true;
                return _prevResult = blank ? StitchResult.Blank : StitchResult.NoMatch;
            }
            Estimated = true;
        }

        LastShift = p - _pos;
        _pos = p;
        _prevAt = p;
        _lost = false;
        if (!still) (_atHash, _atFlat) = (hash, flat); // 没动时保留原来的参照，慢慢挪动也能发现
        // 按估算接时，中间可能还差一段空白：用最后一行（空白）补上
        while (_rows.Count < p + top) AddRow(_rows[^1], _hash[^1], true);
        int from = Math.Max(top, _rows.Count - p);
        if (from >= end)
            return _prevResult = LastShift == 0 ? StitchResult.Unchanged : StitchResult.Behind;

        Append(f, hash, flat, from, end);
        return _prevResult = StitchResult.Appended;
    }

    /// <summary>
    /// 接不上时跳过：结果末尾先接一条标记（marker，同样宽），再把这一帧接在后面，之后以它为准接着截。
    /// </summary>
    public StitchResult Skip(RawImage f, RawImage marker)
    {
        var (hash, flat) = HashRows(f);
        _prevHash = _atHash = hash;
        _atFlat = flat;
        SplitFooter();
        int top = _top, end = _h - _bottom;
        if (marker.Width == _w)
            for (int y = 0; y < marker.Height; y++) AddRow(CopyRow(marker, y), MarkHash, false, index: false);
        // 标记后面从第一行有内容的地方接（开头的空白、吸顶栏下沿的纯色条不要）
        int from = top;
        while (from < end && flat[from]) from++;
        if (from == end) from = top;
        _pos = _rows.Count - from;
        _prevAt = _pos;
        _lost = false;
        LastShift = 0;
        Estimated = true;
        Append(f, hash, flat, from, end);
        Skips++;
        LastDebug = $"跳过，标记在第 {_pos + from - marker.Height} 行";
        return _prevResult = StitchResult.Skipped;
    }

    /// <summary>
    /// 这一帧（去掉固定栏）是不是差不多全是空白：有内容的行不到六分之一（可能只是浮在画面上的按钮）。
    /// 这样的画面不动时，分不清是滚不动了还是在空白里滚。
    /// </summary>
    public bool LooksBlank(RawImage f)
    {
        var flat = HashRows(f).Flat;
        int content = 0;
        for (int i = _top; i < _h - _bottom; i++) if (!flat[i]) content++;
        return content * 6 < _h - _top - _bottom;
    }

    static bool AllFlat(bool[] flat, int from, int to)
    {
        for (int i = from; i < to; i++) if (!flat[i]) return false;
        return true;
    }

    void Append(RawImage f, ulong[] hash, bool[] flat, int from, int end)
    {
        for (int y = from; y < end; y++) AddRow(CopyRow(f, y), hash[y], flat[y]);
        _footer = new byte[_h - end][];
        for (int i = 0; i < _footer.Length; i++) _footer[i] = CopyRow(f, end + i);
        _appended = true;
    }

    /// <summary>还没接上过任何内容时，把第一帧里的底栏挪到 _footer，之后统一接在末尾。</summary>
    void SplitFooter()
    {
        if (_appended || _bottom <= _footer.Length) return;
        int extra = _bottom - _footer.Length;
        var moved = new byte[extra][];
        for (int i = 0; i < extra; i++) moved[i] = _rows[_rows.Count - extra + i];
        RemoveTail(extra);
        _footer = [.. moved, .. _footer];
    }

    /// <summary>
    /// 和上一帧比：顶部、底部位置不变的行（固定栏的候选，要页面确实动了才算数，见 Add）。
    /// 靠内侧的纯色行不算（两帧都是空白，不能说明是固定栏）。最多占画面 1/3。
    /// </summary>
    (int Top, int Bottom) FixedBars(ulong[] hash, bool[] flat)
    {
        int cap = _h / 3;
        int top = 0;
        while (top < cap && hash[top] == _prevHash[top]) top++;
        while (top > 0 && flat[top - 1]) top--;
        int bottom = 0;
        while (bottom < cap && hash[_h - 1 - bottom] == _prevHash[_h - 1 - bottom]) bottom++;
        while (bottom > 0 && flat[_h - bottom]) bottom--;
        return (top, bottom);
    }

    /// <summary>
    /// 在已拼好的结果里找这一帧的位置 p（帧第 i 行 = 结果第 p+i 行）：
    /// 先用每行哈希投票选出候选位置，再逐个核对；对不上返回 int.MinValue。
    /// </summary>
    int Locate(ulong[] hash, bool[] flat, int top, int end, int target)
    {
        var votes = new Dictionary<int, int>();
        for (int i = top; i < end; i++)
        {
            if (flat[i] || !_index.TryGetValue(hash[i], out var at) || at.Count > MaxRepeats) continue;
            foreach (int r in at)
            {
                int p = r - i;
                votes[p] = votes.GetValueOrDefault(p) + 1;
            }
        }
        LastDebug = $"顶栏 {top} 底栏 {_h - end} 票 {votes.Count}:";
        if (votes.Count == 0) return int.MinValue;

        int best = int.MinValue, bestMatches = 0;
        bool bestStrict = false;
        foreach (var (p, _) in votes.OrderByDescending(kv => kv.Value).Take(8))
        {
            int compared = 0, matches = 0, moved = 0, blocks = 0;
            bool missing = false;
            int lo = Math.Max(top, -p), hi = Math.Min(end, _rows.Count - p);
            for (int i = lo; i < hi; i++)
            {
                // 纯色行（空白、纯色标题栏）匹配到哪都差不多，对上对不上都不算证据
                if (flat[i]) continue;
                compared++;
                if (hash[i] == _hash[p + i])
                {
                    matches++;
                    if (hash[i] != _prevHash[i]) moved++;
                    missing = false;
                }
                else if (!missing)
                {
                    blocks++;
                    missing = true;
                }
            }
            LastDebug += $" p={p}({_pos}) {matches}/{compared}" + (blocks > 0 ? $"/{blocks}块" : "");
            bool strict = matches >= MinMatches && matches >= compared * MinMatchRatio;
            // 动图、视频、闪烁的东西：对不上的行连成少数几块，其余的都对得上。
            // 对得上的行得是跟着页面滚动过的（跟上一帧不在同一位置）：浮在画面上不动的东西
            // （悬浮按钮、悬停高亮）在哪一帧都一样，靠它们对上会把位置钉死在原地
            bool loose = moved >= LooseMinMatches && matches >= compared * LooseMatchRatio && blocks <= MaxMismatchBlocks;
            if (!strict && !loose) continue;
            // 严格对上的优先；证据差不多时，选离预计位置最近的（重复内容多的页面防止跳错位置）
            bool better = best == int.MinValue
                || (strict && !bestStrict)
                || (strict == bestStrict && (matches > bestMatches * 1.1
                    || (matches * 1.1 >= bestMatches && Math.Abs(p - target) < Math.Abs(best - target))));
            if (better)
            {
                bestMatches = strict && !bestStrict ? matches : Math.Max(bestMatches, matches);
                best = p;
                bestStrict = strict;
            }
        }
        return best;
    }

    /// <summary>
    /// 找不到位置时，跟上次定位到的那一帧比：版面（哪些行是空白）没变，有内容的行里对不上的只有少数几块，
    /// 就是页面没动，只是动图、视频、加载圈在变（它们占了大半画面、剩下的不够定位时会走到这里）。
    /// 版面里没有空白可参照（整屏都是内容）时，要大部分行对得上才算。
    /// </summary>
    bool Still(ulong[] hash, bool[] flat, int top, int end)
    {
        int moved = 0, edges = 0, compared = 0, matches = 0, blocks = 0;
        bool missing = false;
        for (int i = top; i < end; i++)
        {
            if (i > top && flat[i] != flat[i - 1]) edges++;
            if (flat[i] != _atFlat[i]) moved++;
            else if (flat[i]) continue;
            else if (hash[i] == _atHash[i])
            {
                compared++;
                matches++;
                missing = false;
            }
            else
            {
                compared++;
                if (!missing) blocks++;
                missing = true;
            }
        }
        return moved <= _h / 100 && blocks <= MaxMismatchBlocks && (edges > 0 || matches >= compared * MinMatchRatio);
    }

    /// <summary>
    /// 大段空白比截图区域还高，前后两帧没有重叠的内容：已截内容以空白结尾、这一帧以空白开头，
    /// 就认为中间一直是空白，把两段连起来。有预计位移（自动滚动）按它接，
    /// 否则让两段空白重叠（空白会比实际短一些，内容不会丢）。连不了返回 int.MinValue；
    /// wait = 画面几乎没动、空白后面露出的内容还太少，先当空白处理，等下一帧。
    /// </summary>
    int JoinBlank(ulong[] hash, bool[] flat, ulong[] prev, int top, int end, int? expectedShift, out bool wait)
    {
        // 跟上一帧在同一位置一模一样的行，是浮在画面上不动的东西（悬浮按钮、悬停高亮），跟空白一样当背景
        bool Background(int i) => flat[i] || hash[i] == prev[i];
        int lead = 0;
        while (top + lead < end && Background(top + lead)) lead++;
        // 只有空白和浮着不动的东西：跟全是空白一样，看不出滚到了哪
        wait = top + lead >= end;
        if (wait || _lost) return int.MinValue;
        int changed = 0;
        for (int i = 0; i < _h; i++) if (hash[i] != prev[i]) changed++;
        int band = end - top, min = Math.Max(4, band / 8);
        int tail = 0;
        while (tail < _rows.Count && _flat[_rows.Count - 1 - tail]) tail++;
        if (tail < min || lead < min) return int.MinValue;

        // 空白后面的内容得是新的（多数行在已截内容里找不到；到处都有的行不算数）
        int content = 0, known = 0;
        for (int i = top + lead; i < end; i++)
        {
            if (Background(i)) continue;
            content++;
            if (_index.TryGetValue(hash[i], out var at) && at.Count <= 2) known++;
        }
        if (known * 2 > content) return int.MinValue;
        // 画面几乎没动（只有空白里的加载圈在转），或者内容才露出一点点：先等等
        if (changed < _h / 30 || content < MinMatches)
        {
            wait = true;
            return int.MinValue;
        }

        int p = _rows.Count - top - Math.Min(tail, lead);
        if (expectedShift is int e) p = Math.Clamp(_pos + e, p, _rows.Count - top + band * 2);
        LastDebug += $" 空白相连 尾{tail} 头{lead} p={p}";
        return p;
    }

    void AddRow(byte[] row, ulong hash, bool flat, bool index = true)
    {
        if (!flat && index)
        {
            if (!_index.TryGetValue(hash, out var at)) _index[hash] = at = [];
            at.Add(_rows.Count);
        }
        _rows.Add(row);
        _hash.Add(hash);
        _flat.Add(flat);
    }

    void RemoveTail(int count)
    {
        for (int r = _rows.Count - count; r < _rows.Count; r++)
            if (!_flat[r] && _index.TryGetValue(_hash[r], out var at)) at.Remove(r);
        int start = _rows.Count - count;
        _rows.RemoveRange(start, count);
        _hash.RemoveRange(start, count);
        _flat.RemoveRange(start, count);
    }

    (ulong[] Hash, bool[] Flat) HashRows(RawImage img)
    {
        var hash = new ulong[_h];
        var flat = new bool[_h];
        int len = Math.Max(1, _c1 - _c0);
        for (int y = 0; y < _h; y++)
        {
            var row = MemoryMarshal.Cast<byte, uint>(img.Pixels.AsSpan(y * img.Stride + _c0 * 4, len * 4));
            ulong h = 14695981039346656037UL;
            // 每个颜色通道只取高 4 位：渲染时的细微色差（抗锯齿、图片缩放）不影响匹配
            uint first = row[0] & 0xF0F0F0;
            bool isFlat = true;
            foreach (uint raw in row)
            {
                uint v = raw & 0xF0F0F0;
                h = (h ^ v) * 1099511628211UL;
                if (v != first) isFlat = false;
            }
            hash[y] = h;
            flat[y] = isFlat;
        }
        return (hash, flat);
    }

    static byte[] CopyRow(RawImage img, int y) => img.Pixels.AsSpan(y * img.Stride, img.Stride).ToArray();

    public RawImage Build()
    {
        int h = Height, stride = _w * 4;
        var px = new byte[stride * h];
        int y = 0;
        foreach (var row in _rows) Buffer.BlockCopy(row, 0, px, stride * y++, stride);
        foreach (var row in _footer) Buffer.BlockCopy(row, 0, px, stride * y++, stride);
        return new RawImage(_w, h, px);
    }
}
