using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace SnapTool.Capture;

/// <summary>
/// 滚动长截图：自动向下滚动并逐帧拼接。
/// 用户一动鼠标就切换为手动模式（自己滚动，程序继续拼接）；到底、点完成或按 Esc 结束。
/// 中间没接上时：自动模式会自己往回滚一点、改用更小的步子重试，还不行就跳过这一段（图里留标记）接着截；
/// 手动模式下往回滚到截过的地方就能接着截，不往回滚的话过一会儿（或点「跳过」）也会跳过这一段。
/// </summary>
public sealed class LongCaptureSession(Int32Rect area, Action<BitmapSource?> done)
{
    const int MaxHeight = 30000;
    const uint VK_ESCAPE = 0x1B;
    const int MinStep = 15;       // 滚轮最小步长（标准一格是 120）
    const int MaxRetries = 3;     // 自动模式往回滚这么多次还接不上，就跳过这一段
    const int MaxIdle = 3;        // 自动模式连续这么多次滚不动 = 到底了
    const int MaxBlankIdle = 12;  // 画面全是空白时分不清是滚不动还是在空白里滚，多滚几次再说
    static readonly TimeSpan SkipAfter = TimeSpan.FromSeconds(2.5); // 手动模式接不上这么久就自动跳过

    FrameWindow? _frame;
    LongCaptureBar? _bar;
    bool _stop, _cancel, _skip, _auto = true;
    Native.POINT _parked;
    int _escId = -1;
    RawImage? _marker;

    /// <summary>测试用：设置后每一步的拼接结果都会写到这里。</summary>
    public static Action<string>? DebugLog;

    /// <summary>测试用：相当于点「完成」。</summary>
    public void Finish() => _stop = true;

    public async void Start()
    {
        _frame = new FrameWindow(area);
        _frame.Show();
        _bar = new LongCaptureBar(area);
        _bar.FinishRequested += () => _stop = true;
        _bar.CancelRequested += () => _cancel = true;
        _bar.SkipRequested += () => _skip = true;
        _bar.Show();
        _escId = App.Current.Hotkeys.Register(0, VK_ESCAPE, () => _stop = true);

        Stitcher? stitcher = null;
        try
        {
            await Task.Delay(300);
            var first = Grab();
            stitcher = new Stitcher(first);
            _bar.Update(stitcher.Height, _auto, null);
            ParkCursor();

            // 步长单位是滚轮刻度（120 = 一格）。根据实际滚动的距离自动调整：
            // 目标是每次滚动可比较区域的一半左右，既快又留足重叠。
            int step = 120;
            double pxPerUnit = 0; // 滚轮每个刻度大约让页面移动多少像素，从实际滚动中学习
            int pending = 0;      // 上次定位以后，在空白里又往下滚了大约多少像素
            int idle = 0;         // 连续几次往下滚画面都没动
            int blank = 0;        // 连续几次画面全是空白
            bool scrolled = false;
            DateTime? lostSince = null; // 手动模式：从什么时候开始接不上
            var prev = first;
            while (!_stop && !_cancel)
            {
                if (_auto && CursorMovedByUser())
                {
                    _auto = false;
                    _bar.Update(stitcher.Height, _auto, null, skips: stitcher.Skips);
                }

                StitchResult result;
                bool stuck = false;
                if (_auto)
                {
                    Native.SendWheel(-step);
                    var frame = await GrabWhenSettled();
                    if (_stop || _cancel) break;

                    // 画面基本没变（只有加载圈之类的小动画在动）= 滚不动了；差不多全是空白时分不清，按空白算
                    int? expected = pxPerUnit > 0 ? pending + (int)Math.Round(pxPerUnit * step) : null;
                    result = AlmostSame(frame, prev)
                        ? stitcher.LooksBlank(frame) ? StitchResult.Blank : StitchResult.Unchanged
                        : stitcher.Add(frame, expected);
                    if (result == StitchResult.Appended && !stitcher.Estimated && blank == 0)
                    {
                        double r = (double)stitcher.LastShift / step;
                        pxPerUnit = pxPerUnit == 0 ? r : pxPerUnit * 0.7 + r * 0.3;
                    }
                    prev = frame;
                    if (result == StitchResult.NoMatch)
                    {
                        DebugLog?.Invoke($"  往下 NoMatch  {stitcher.LastDebug}");
                        (result, prev) = await Recover(stitcher, step, frame);
                        step = Smaller(step);
                    }

                    if (result == StitchResult.Blank)
                    {
                        if (pxPerUnit > 0) pending += (int)Math.Round(pxPerUnit * step);
                        if (++blank >= MaxBlankIdle) EndAuto(scrolled, ref stuck);
                    }
                    else if (result != StitchResult.NoMatch)
                    {
                        // 定位到了（或者跳过了）：从这里重新算
                        pending = blank = 0;
                        if (result is StitchResult.Appended or StitchResult.Skipped)
                        {
                            idle = 0;
                            scrolled = true;
                        }
                        if (result == StitchResult.Appended && !stitcher.Estimated)
                        {
                            int shift = stitcher.LastShift, target = stitcher.ContentHeight / 2;
                            if (shift > stitcher.ContentHeight * 0.7) step = Smaller(step);
                            else if (shift * 3 < target * 2 && step < 1200) step = step >= 120 ? step + 120 : step * 2;
                        }
                        else if (result == StitchResult.Unchanged && ++idle >= MaxIdle) EndAuto(scrolled, ref stuck);
                    }
                }
                else
                {
                    await Task.Delay(100);
                    var frame = Grab();
                    if (_stop || _cancel) break;
                    result = stitcher.Add(frame);
                    if (result == StitchResult.NoMatch)
                    {
                        // 接不上：给用户一点时间往回滚；不往回滚（或者点了「跳过」）就跳过这一段，从这里接着截
                        lostSince ??= DateTime.Now;
                        if (_skip || DateTime.Now - lostSince >= SkipAfter)
                        {
                            DebugLog?.Invoke($"  手动 NoMatch {(_skip ? "点了跳过" : "太久")}  {stitcher.LastDebug}");
                            result = stitcher.Skip(frame, Marker());
                            lostSince = null;
                        }
                    }
                    else if (result != StitchResult.Blank) lostSince = null;
                    _skip = false;
                    prev = frame;
                }

                DebugLog?.Invoke($"{(_auto ? "自动" : "手动")} {result,-9} 步长 {step,4} 位移 {stitcher.LastShift,5} 可比区域 {stitcher.ContentHeight,4} 总高 {stitcher.Height}" + (stitcher.Estimated ? "（按估算接）" : "") + (result is StitchResult.NoMatch or StitchResult.Skipped || stitcher.Estimated ? "  " + stitcher.LastDebug : ""));
                _bar.Update(stitcher.Height, _auto, result, stuck, stitcher.Skips, lostSince is { } t ? SkipAfter - (DateTime.Now - t) : null);
                if (stitcher.Height >= MaxHeight) _stop = true;
            }
        }
        finally
        {
            App.Current.Hotkeys.Unregister(_escId);
            _frame.Close();
            _bar.Close();
        }

        done(_cancel || stitcher == null ? null : stitcher.Build().ToBitmapSource());
    }

    /// <summary>
    /// 连续几次往下滚画面都不动：滚动过 = 到底了；
    /// 一开始就滚不动 = 这个程序不接受模拟滚轮，改为让用户自己滚。
    /// </summary>
    void EndAuto(bool scrolled, ref bool stuck)
    {
        if (scrolled) _stop = true;
        else
        {
            _auto = false;
            stuck = true;
        }
    }

    /// <summary>
    /// 自动模式没接上（滚过头、页面变了）：先往回滚，回到截过的地方就算接上，之后用更小的步子往下滚；
    /// 往回滚几次还是接不上，就滚回原处，跳过这一段（图里留标记），从那里接着往下截。
    /// </summary>
    async Task<(StitchResult, RawImage)> Recover(Stitcher stitcher, int step, RawImage lost)
    {
        var result = StitchResult.NoMatch;
        var frame = lost;
        int back = 0;
        for (int i = 0; i < MaxRetries && step > MinStep && (result is StitchResult.NoMatch or StitchResult.Blank) && !_stop && !_cancel; i++)
        {
            _bar!.Update(stitcher.Height, _auto, StitchResult.NoMatch, skips: stitcher.Skips);
            Native.SendWheel(step);
            back += step;
            frame = await GrabWhenSettled();
            result = stitcher.Add(frame);
            DebugLog?.Invoke($"  往回滚 {step} → {result}  {stitcher.LastDebug}");
        }
        if ((result is StitchResult.NoMatch or StitchResult.Blank) && !_stop && !_cancel)
        {
            if (back > 0)
            {
                Native.SendWheel(-back);
                frame = await GrabWhenSettled();
                result = stitcher.Add(frame);
                DebugLog?.Invoke($"  滚回原处 → {result}  {stitcher.LastDebug}");
            }
            if (result == StitchResult.NoMatch) result = stitcher.Skip(frame, Marker());
        }
        return (result, frame);
    }

    RawImage Grab() => ScreenCapture.Capture(area.X, area.Y, area.Width, area.Height);

    RawImage Marker() => _marker ??= MakeMarker(area.Width, _frame == null ? 1 : VisualTreeHelper.GetDpi(_frame).DpiScaleY);

    /// <summary>跳过的地方在结果里画的标记：上下两道锯齿“断口”，中间写明这里跳过了一段。</summary>
    internal static RawImage MakeMarker(int width, double scale)
    {
        int h = (int)Math.Round(34 * scale);
        var paper = new SolidColorBrush(Color.FromRgb(0xFF, 0xF1, 0xE0));
        var ink = new SolidColorBrush(Color.FromRgb(0xC2, 0x41, 0x0C));
        var pen = new Pen(new SolidColorBrush(Color.FromRgb(0xF9, 0x73, 0x16)), Math.Max(1, 1.5 * scale));
        var dv = new DrawingVisual();
        using (var dc = dv.RenderOpen())
        {
            dc.DrawRectangle(paper, null, new Rect(0, 0, width, h));
            double t = 5 * scale;
            foreach (double y in new[] { t, h - t })
            {
                var zigzag = new StreamGeometry();
                using (var g = zigzag.Open())
                {
                    g.BeginFigure(new Point(0, y - t / 2), false, false);
                    for (int k = 1; (k - 1) * t <= width; k++) g.LineTo(new Point(k * t, y + (k % 2 == 1 ? t : -t) / 2), true, false);
                }
                dc.DrawGeometry(null, pen, zigzag);
            }
            var text = new FormattedText("✂  这里没接上，跳过了一段（可能缺了些内容）", CultureInfo.CurrentUICulture, FlowDirection.LeftToRight,
                new Typeface(new FontFamily("Microsoft YaHei UI"), FontStyles.Normal, FontWeights.SemiBold, FontStretches.Normal), 12 * scale, ink, 1.0);
            dc.DrawText(text, new Point(Math.Max(4, (width - text.Width) / 2), (h - text.Height) / 2));
        }
        var bmp = new RenderTargetBitmap(width, h, 96, 96, PixelFormats.Pbgra32);
        bmp.Render(dv);
        return RawImage.FromBitmapSource(bmp);
    }

    /// <summary>步长缩小：一格以上按整格减半，一格以下再对半分。</summary>
    static int Smaller(int step) => step > 120 ? Math.Max(120, step / 240 * 120) : Math.Max(MinStep, step / 2);

    /// <summary>
    /// 等平滑滚动停下来再截：连续两次截图几乎一样就算停稳。
    /// 只要求 97% 的行不变，页面上有加载圈、动图之类一直在动的小东西也不会白等。
    /// </summary>
    async Task<RawImage> GrabWhenSettled()
    {
        await Task.Delay(100);
        var last = Grab();
        for (int i = 0; i < 10 && !_stop && !_cancel; i++)
        {
            await Task.Delay(50);
            var now = Grab();
            if (AlmostSame(now, last)) return now;
            last = now;
        }
        return last;
    }

    static bool AlmostSame(RawImage a, RawImage b)
    {
        int allowed = a.Height * 3 / 100, diff = 0;
        for (int y = 0; y < a.Height; y++)
        {
            if (!a.Pixels.AsSpan(y * a.Stride, a.Stride).SequenceEqual(b.Pixels.AsSpan(y * b.Stride, b.Stride)) && ++diff > allowed)
                return false;
        }
        return true;
    }

    /// <summary>
    /// 鼠标放在区域右侧靠边处（通常是滚动条上）：滚轮照样生效，
    /// 又不会压在正文上让内容随滚动出现悬停高亮，影响拼接。
    /// </summary>
    void ParkCursor()
    {
        int inset = Math.Min(20, area.Width / 4);
        Native.SetCursorPos(area.X + area.Width - inset, area.Y + area.Height / 2);
        Native.GetCursorPos(out _parked);
    }

    bool CursorMovedByUser()
    {
        Native.GetCursorPos(out var p);
        return Math.Abs(p.X - _parked.X) > 4 || Math.Abs(p.Y - _parked.Y) > 4;
    }
}

/// <summary>长截图区域四周的虚线框，鼠标可以穿透，不会出现在截图里。</summary>
sealed class FrameWindow : Window
{
    public FrameWindow(Int32Rect r)
    {
        ThemeMode = ThemeMode.None;
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        Content = new Rectangle { Stroke = UiKit.AccentBrush, StrokeThickness = 2, StrokeDashArray = [4, 2] };

        SourceInitialized += (_, _) =>
        {
            var hwnd = this.Handle();
            Native.MakeClickThrough(hwnd);
            Native.SetWindowDisplayAffinity(hwnd, Native.WDA_EXCLUDEFROMCAPTURE);
            HwndSource.FromHwnd(hwnd)!.AddHook((IntPtr h, int msg, IntPtr w, IntPtr l, ref bool handled) =>
            {
                if (msg == Native.WM_DPICHANGED) handled = true;
                return IntPtr.Zero;
            });
            const int pad = 4;
            Native.PlaceWindow(hwnd, r.X - pad, r.Y - pad, r.Width + pad * 2, r.Height + pad * 2);
        };
    }
}

/// <summary>长截图时的状态条：显示已拼接高度，提供完成 / 取消按钮。</summary>
sealed class LongCaptureBar : Window
{
    readonly Int32Rect _area;
    readonly TextBlock _status = new() { Foreground = Brushes.White, FontSize = 14, FontWeight = FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center, MinWidth = 330 };
    readonly TextBlock _hint = new() { Foreground = Brushes.White, Opacity = 0.75, FontSize = 12, Margin = new Thickness(0, 2, 0, 0) };
    readonly Border _skip;

    public event Action? FinishRequested;
    public event Action? CancelRequested;
    public event Action? SkipRequested;

    public LongCaptureBar(Int32Rect area)
    {
        _area = area;
        ThemeMode = ThemeMode.None;
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        SizeToContent = SizeToContent.WidthAndHeight;

        var text = new StackPanel { Margin = new Thickness(10, 4, 14, 4), VerticalAlignment = VerticalAlignment.Center };
        text.Children.Add(_status);
        text.Children.Add(_hint);
        var row = new StackPanel { Orientation = Orientation.Horizontal };
        row.Children.Add(text);
        _skip = UiKit.Chip("", "跳过", () => SkipRequested?.Invoke(), tooltip: "这一段接不上就不要了：图里留个标记，从现在的位置接着截");
        _skip.Visibility = Visibility.Collapsed;
        row.Children.Add(_skip);
        row.Children.Add(UiKit.Chip("", "取消", () => CancelRequested?.Invoke()));
        row.Children.Add(UiKit.Chip("", "完成", () => FinishRequested?.Invoke(), accent: true));
        var panel = UiKit.Panel(row);
        panel.Margin = new Thickness(14); // 给阴影留位置
        Content = panel;

        SourceInitialized += (_, _) =>
        {
            Native.MakeToolWindow(this.Handle());
            Native.SetWindowDisplayAffinity(this.Handle(), Native.WDA_EXCLUDEFROMCAPTURE);
        };
        Loaded += (_, _) => PlaceNearArea();
        SizeChanged += (_, _) => { if (IsLoaded) PlaceNearArea(); }; // 文字变长、「跳过」出现时右边缘不动
        Cursor = Cursors.Arrow;
    }

    void PlaceNearArea()
    {
        var hwnd = this.Handle();
        Native.GetWindowRect(hwnd, out var me);
        var work = Native.WorkAreaAt(_area.X + _area.Width / 2, _area.Y + _area.Height);
        int x = Math.Clamp(_area.X + _area.Width - me.Width, work.Left, Math.Max(work.Left, work.Right - me.Width));
        int y = _area.Y + _area.Height + 10;
        if (y + me.Height > work.Bottom) y = _area.Y - me.Height - 10;           // 下面放不下放上面
        if (y < work.Top) y = _area.Y + _area.Height - me.Height - 10;            // 都放不下就放在区域内（不会被截进去）
        Native.MoveWindow(hwnd, x, y);
    }

    bool _stuckShown;
    DateTime _skippedAt;

    /// <param name="skipIn">手动模式接不上时，还有多久自动跳过</param>
    public void Update(int height, bool auto, StitchResult? last, bool stuck = false, int skips = 0, TimeSpan? skipIn = null)
    {
        if (stuck) _stuckShown = true;
        if (last == StitchResult.Skipped) _skippedAt = DateTime.Now;
        bool justSkipped = DateTime.Now - _skippedAt < TimeSpan.FromSeconds(3);
        string skipped = skips > 0 ? $" · 跳过 {skips} 处" : "";
        _status.Text = auto
            ? $"正在自动往下滚动…  已截 {height} 像素{skipped}"
            : $"请用鼠标滚轮往下滚动  已截 {height} 像素{skipped}";
        _hint.Text = last switch
        {
            StitchResult.NoMatch when auto => "滚过头了，正在往回滚一点重新接上…",
            StitchResult.NoMatch => $"没接上：往回滚一点就能接上，否则 {Math.Max(1, Math.Ceiling(skipIn?.TotalSeconds ?? 0))} 秒后跳过这一段（图里会留标记）",
            _ when justSkipped => "这一段实在接不上，已跳过（图里留了标记），接着往下截",
            StitchResult.Blank => auto ? "这一段是空白，继续往下滚…" : "这一段是空白，继续往下滚就行",
            StitchResult.Behind => "已回到截过的位置，继续往下滚就能接着截",
            _ when auto => "滚到底会自动结束 · 想提前结束按 Esc 或点「完成」",
            _ when _stuckShown => "自动滚动不顺利，请把鼠标放进虚线框里自己慢慢滚 · 滚完点「完成」",
            _ => "把鼠标放在虚线框里往下滚 · 滚完按 Esc 或点「完成」",
        };
        _skip.Visibility = !auto && last == StitchResult.NoMatch ? Visibility.Visible : Visibility.Collapsed;
    }
}
