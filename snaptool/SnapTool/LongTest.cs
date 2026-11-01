using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows;
using SnapTool.Capture;
using SnapTool.Export;

namespace SnapTool;

/// <summary>
/// SnapTool.exe --longtest 输出目录 [--manual]：用 Chrome（临时配置）打开一个“难截”的长网页
/// （吸顶栏、悬停高亮、比截图区域还高的空白、一直在变色的大横幅、闪烁的块），
/// 对它跑一次真实的长截图，结果图和每一步的日志写到输出目录。会动鼠标、滚动屏幕，约半分钟。
/// --manual：模拟用户手动滚（一次滚 1~3 格，中间猛地滚一大下）。
/// --sim：不开窗口、不动鼠标，见 Simulate。
/// </summary>
static class LongTest
{
    const string Title = "SnapTool长截图测试";
    const string Chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";

    public static async Task Run(string[] args)
    {
        string dir = args.Length > 0 ? args[0] : Environment.CurrentDirectory;
        Directory.CreateDirectory(dir);
        var log = new StringBuilder();
        LongCaptureSession.DebugLog = s => log.AppendLine(s);
        Process? edge = null;
        try
        {
            string html = Path.Combine(dir, "page.html");
            File.WriteAllText(html, MakePage(), Encoding.UTF8);
            string profile = Path.Combine(dir, "chrome-profile");
            if (args.Contains("--sim"))
            {
                await Simulate(dir, html, profile, log);
                return;
            }
            edge = Process.Start(new ProcessStartInfo(Chrome,
                $"--user-data-dir=\"{profile}\" --no-first-run --no-default-browser-check --window-position=40,20 --window-size=760,700 --app=\"{new Uri(html).AbsoluteUri}\""));

            IntPtr hwnd = IntPtr.Zero;
            for (int i = 0; i < 60 && hwnd == IntPtr.Zero; i++)
            {
                await Task.Delay(250);
                hwnd = Process.GetProcessesByName("chrome").FirstOrDefault(p => p.MainWindowTitle.Contains(Title))?.MainWindowHandle ?? IntPtr.Zero;
            }
            if (hwnd == IntPtr.Zero) throw new Exception("没找到 Chrome 测试窗口");
            Native.SetForegroundWindow(hwnd);
            await Task.Delay(1500);
            Native.GetWindowRect(hwnd, out var r);
            var area = new Int32Rect(r.Left + 10, r.Top + 90, r.Width - 20, r.Height - 100);
            log.AppendLine($"窗口 {r.Left},{r.Top} {r.Width}×{r.Height}  截图区域 {area.X},{area.Y} {area.Width}×{area.Height}");

            if (args.Contains("--frames"))
            {
                // 诊断：滚一格前后各存一张，看看画面到底差在哪
                Native.SetCursorPos(area.X + area.Width - 20, area.Y + area.Height / 2);
                await Task.Delay(300);
                void Save(string name) => File.WriteAllBytes(Path.Combine(dir, name),
                    ImageExport.EncodeSimple(ScreenCapture.Capture(area.X, area.Y, area.Width, area.Height).ToBitmapSource(), ExportFormat.Png));
                Save("f0.png");
                Native.SendWheel(-120);
                await Task.Delay(1200);
                Save("f1.png");
                await Task.Delay(1000);
                Save("f1b.png");
                Native.SendWheel(-120);
                await Task.Delay(1200);
                Save("f2.png");
                return;
            }

            var tcs = new TaskCompletionSource<System.Windows.Media.Imaging.BitmapSource?>();
            var sw = Stopwatch.StartNew();
            var session = new LongCaptureSession(area, b => tcs.SetResult(b));
            session.Start();
            if (args.Contains("--manual"))
            {
                // 一动鼠标就切到手动模式，之后像人一样滚
                await Task.Delay(800);
                Native.SetCursorPos(area.X + area.Width / 3, area.Y + area.Height / 2);
                var rnd = new Random(11);
                for (int i = 0; i < 75 && !tcs.Task.IsCompleted; i++)
                {
                    int notches = i == 20 ? 12 : rnd.Next(1, 4);
                    log.AppendLine($"[测试] 往下滚 {notches} 格");
                    Native.SendWheel(-120 * notches);
                    await Task.Delay(i == 20 ? 4000 : rnd.Next(200, 500));
                }
                await Task.Delay(1500);
                session.Finish();
            }
            var result = await tcs.Task;
            log.AppendLine($"用时 {sw.Elapsed.TotalSeconds:F1} 秒，结果 {result?.PixelWidth}×{result?.PixelHeight}");
            if (result != null) File.WriteAllBytes(Path.Combine(dir, "long.png"), ImageExport.EncodeSimple(result, ExportFormat.Png));
        }
        catch (Exception ex)
        {
            log.AppendLine("出错：" + ex);
        }
        finally
        {
            LongCaptureSession.DebugLog = null;
            try { edge?.Kill(true); } catch { }
            await Task.Delay(1000);
            try { Directory.Delete(Path.Combine(dir, "chrome-profile"), true); } catch { }
            File.WriteAllText(Path.Combine(dir, "longtest.log"), log.ToString(), Encoding.UTF8);
        }
    }

    /// <summary>
    /// 用无界面 Chrome 把测试页渲染成一整张长图，再从上面切出一帧帧“滚动画面”喂给拼接：
    /// 每一帧动图横幅、闪烁块都变个样，加上鼠标悬停高亮、吸顶栏。先按自动滚动（知道滚了多少）跑一遍，
    /// 再按手动乱滚（不知道滚了多少，有停顿、中间猛地滚一大下）跑一遍，检查有没有漏掉、重复、错位的内容。
    /// </summary>
    static async Task Simulate(string dir, string html, string profile, StringBuilder log)
    {
        string png = Path.Combine(dir, "full.png");
        using (var chrome = Process.Start(new ProcessStartInfo(Chrome,
            $"--headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=740,9000 --user-data-dir=\"{profile}\" --screenshot=\"{png}\" \"{new Uri(html).AbsoluteUri}\"")
            { UseShellExecute = false, CreateNoWindow = true })!)
            await chrome.WaitForExitAsync();
        var full = RawImage.FromBitmapSource(System.Windows.Media.Imaging.BitmapDecoder.Create(new Uri(png),
            System.Windows.Media.Imaging.BitmapCreateOptions.None, System.Windows.Media.Imaging.BitmapCacheOption.OnLoad).Frames[0]);
        int W = full.Width, H = 1100;
        int pageH = full.Height;
        while (pageH > H && full.Pixels.AsSpan((pageH - 1) * full.Stride, full.Stride).IndexOfAnyExcept((byte)255) < 0) pageH--;
        pageH = Math.Min(full.Height, pageH + 100);

        // 变色横幅、闪烁块：左边缘偏红的行（多算几行，圆角处也算上）
        var anim = new bool[full.Height];
        for (int y = 0; y < pageH; y++)
        {
            var c = full.GetPixel(100, y);
            if (c.R > 180 && c.G < 90 && c.B < 120)
                for (int k = Math.Max(0, y - 6); k < Math.Min(pageH, y + 7); k++) anim[k] = true;
        }
        log.AppendLine($"整页 {W}×{pageH}，动图行 {anim.Count(a => a)}");

        int n = 0;
        RawImage Frame(int o)
        {
            n++;
            var px = new byte[W * H * 4];
            Buffer.BlockCopy(full.Pixels, o * W * 4, px, 0, W * H * 4);
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                int i = (y * W + x) * 4;
                if (o > 600 && y < 88) // 吸顶栏
                {
                    bool text = y is >= 30 and < 58 && x < 600 && x / 9 % 7 < 4;
                    px[i] = px[i + 1] = px[i + 2] = text ? (byte)255 : (byte)40;
                }
                else if (anim[o + y]) // 动图：每一帧颜色都不一样
                {
                    byte b = px[i], g = px[i + 1], r = px[i + 2];
                    (px[i], px[i + 1], px[i + 2]) = (n % 3) switch { 0 => (g, r, b), 1 => (r, b, g), _ => (b, g, r) };
                    px[i] = (byte)(px[i] + 37 * n);
                }
                else if (y >= H / 2 - 40 && y < H / 2 + 40 && x > 80 && x < W - 80 && px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240)
                    (px[i], px[i + 1], px[i + 2]) = ((byte)254, (byte)234, (byte)219); // 鼠标下面那段的悬停高亮
            }
            return new RawImage(W, H, px);
        }

        var marker = LongCaptureSession.MakeMarker(W, 2);
        int maxO = pageH - H;
        foreach (bool manual in new[] { false, true })
        {
            var rnd = new Random(manual ? 5 : 3);
            var st = new Stitcher(Frame(0));
            int o = 0, located = 0, skips = 0, steps = 0;
            var counts = new Dictionary<StitchResult, int>();
            void Feed(int at, bool estimate)
            {
                var r = st.Add(Frame(at), estimate ? at - located : null);
                if (r == StitchResult.NoMatch && manual)
                {
                    // 用户停在那里不往回滚：过一会儿自动跳过
                    for (int k = 0; k < 2 && r == StitchResult.NoMatch; k++) r = st.Add(Frame(at));
                    if (r == StitchResult.NoMatch) { r = st.Skip(Frame(at), marker); skips++; }
                }
                else if (r == StitchResult.NoMatch)
                {
                    log.AppendLine($"  自动 NoMatch @{at}: {st.LastDebug}");
                    r = st.Skip(Frame(at), marker);
                    skips++;
                }
                if (r is StitchResult.Appended or StitchResult.Unchanged or StitchResult.Behind or StitchResult.Skipped) located = at;
                counts[r] = counts.GetValueOrDefault(r) + 1;
                if (manual || r is StitchResult.NoMatch or StitchResult.Skipped || st.Estimated)
                    log.AppendLine($"  {(manual ? "手动" : "自动")} @{at} {r} 总高 {st.Height}  {st.LastDebug}");
            }
            while (o < maxO && steps++ < 400)
            {
                if (!manual)
                {
                    o = Math.Min(maxO, o + 480 + rnd.Next(-40, 41));
                    Feed(o, estimate: true);
                    continue;
                }
                int d = steps == 15 ? 3000 : 200 * rnd.Next(1, 4); // 一次 1~3 格，第 15 下猛地滚一大下
                int to = Math.Min(maxO, o + d);
                Feed(o + (to - o) / 2, false); // 平滑滚动途中被截到的一帧
                o = to;
                Feed(o, false);
                if (rnd.Next(6) == 0) for (int k = 0; k < 3; k++) Feed(o, false); // 停一停，动图还在动
            }

            // 检查：结果里每一行内容在原页面上的位置应该一直往下走（不重复、不错位），页面上的内容都在（跳过的除外）
            var img = st.Build();
            File.WriteAllBytes(Path.Combine(dir, manual ? "sim_manual.png" : "sim_auto.png"), ImageExport.EncodeSimple(img.ToBitmapSource(), ExportFormat.Png));
            string Key(RawImage im, int y) => Convert.ToBase64String(System.Security.Cryptography.SHA1.HashData(im.Pixels.AsSpan(y * im.Stride + 400, im.Stride - 800)));
            bool Plain(RawImage im, int y) => im.Pixels.AsSpan(y * im.Stride + 400, im.Stride - 800).IndexOfAnyExcept(im.Pixels[y * im.Stride + 400]) < 0;
            var where = new Dictionary<string, int>();
            var dup = new HashSet<string>();
            var keys = new string?[pageH];
            for (int y = 0; y < pageH; y++)
            {
                if (anim[y] || Plain(full, y)) continue;
                var k = keys[y] = Key(full, y);
                if (!where.TryAdd(k, y)) dup.Add(k);
            }
            int back = 0, last = -1;
            var seen = new HashSet<int>();
            var backs = new List<string>();
            for (int y = 0; y < img.Height; y++)
            {
                if (Plain(img, y)) continue;
                var k = Key(img, y);
                if (dup.Contains(k) || !where.TryGetValue(k, out int py)) continue;
                if (py < last - 2)
                {
                    back++;
                    if (backs.Count < 10) backs.Add($"结果第 {y} 行 = 页面第 {py} 行，前面已经到了 {last}");
                }
                seen.Add(py);
                last = Math.Max(last, py);
            }
            int total = where.Count - dup.Count;
            var missing = new List<string>();
            int run = -1;
            for (int y = 0; y <= pageH; y++)
            {
                bool miss = y < pageH && keys[y] is { } k && !dup.Contains(k) && !seen.Contains(y);
                if (miss && run < 0) run = y;
                if (!miss && run >= 0)
                {
                    if (y - run > 3) missing.Add($"{run}~{y}");
                    run = -1;
                }
            }
            log.AppendLine($"{(manual ? "手动乱滚" : "自动滚动")}：{steps} 步，结果 {img.Width}×{img.Height}，跳过 {skips} 处，" +
                string.Join(" ", counts.Select(kv => $"{kv.Key} {kv.Value}")));
            log.AppendLine($"  页面内容行 {total}，结果里找到 {seen.Count}（{seen.Count * 100.0 / total:F1}%），往回跳（重复/错位）{back} 次");
            foreach (var b in backs) log.AppendLine("    " + b);
            log.AppendLine("  缺的段落（页面行号）：" + (missing.Count == 0 ? "无" : string.Join(", ", missing.Take(30))));
        }
    }

    static string MakePage()
    {
        var sb = new StringBuilder();
        sb.Append($$"""
            <!doctype html><html><head><meta charset="utf-8"><title>{{Title}}</title><style>
            body { font: 16px "Microsoft YaHei"; margin: 0; padding: 20px 40px; background: #fff; color: #222; }
            p { margin: 6px 0; padding: 4px 8px; border-radius: 4px; }
            p:hover { background: #dbeafe; }
            #bar { position: fixed; top: 0; left: 0; right: 0; height: 44px; background: #1e293b; color: #fff;
                   line-height: 44px; padding-left: 20px; display: none; }
            .pic { height: 160px; margin: 10px 0; border-radius: 8px; }
            .anim { height: 200px; margin: 10px 0; border-radius: 8px; padding: 24px; color: #fff; font-size: 30px; box-sizing: border-box;
                    background: linear-gradient(90deg,#f43f5e,#6366f1,#22c55e); animation: h 1.2s linear infinite; }
            @keyframes h { to { filter: hue-rotate(360deg); } }
            .blink { height: 120px; margin: 10px 0; background: #dc2626; color: #fff; font-size: 40px; line-height: 120px; text-align: center;
                     animation: bl 0.5s steps(1) infinite; }
            @keyframes bl { 50% { background: #fde047; color: #111; } }
            .spin { display: inline-block; width: 14px; height: 14px; border: 3px solid #94a3b8; border-top-color: #2563eb;
                    border-radius: 50%; animation: s 0.8s linear infinite; vertical-align: middle; }
            @keyframes s { to { transform: rotate(360deg); } }
            </style></head><body>
            <div id="bar">吸顶栏：往下滚动后出现</div>
            <h1>长截图测试页</h1>
            """);
        var rnd = new Random(7);
        string words = "截图拼接滚动页面内容测试文字段落标题按钮图片链接表格列表数据结果显示窗口程序鼠标键盘屏幕";
        for (int i = 1; i <= 160; i++)
        {
            int len = rnd.Next(20, 90);
            var t = new string(Enumerable.Range(0, len).Select(_ => words[rnd.Next(words.Length)]).ToArray());
            string spin = i % 25 == 0 ? "<span class=\"spin\"></span> " : "";
            sb.Append($"<p>{spin}<b>第 {i:000} 段</b>　{t}</p>\n");
            if (i % 30 == 0) sb.Append($"<div class=\"pic\" style=\"background:linear-gradient(90deg,hsl({i * 7},70%,60%),hsl({i * 7 + 120},70%,45%))\"></div>\n");
            if (i == 40) sb.Append("<div class=\"anim\">一直在变色的横幅（动图）</div>\n");
            if (i == 80) sb.Append("<div style=\"height:1500px\"></div>\n");
            if (i == 120) sb.Append("<div class=\"blink\">● LIVE 直播中</div>\n");
        }
        sb.Append("<p><b>—— 页面到底了 ——</b></p><script>addEventListener('scroll',()=>bar.style.display=scrollY>300?'block':'none')</script></body></html>");
        return sb.ToString();
    }
}
