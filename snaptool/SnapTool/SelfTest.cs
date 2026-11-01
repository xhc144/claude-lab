using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using SnapTool.Capture;
using SnapTool.Editor;
using SnapTool.Export;

namespace SnapTool;

/// <summary>SnapTool.exe --selftest [输出目录]：自动检查拼接、导出、渲染，结果写入 selftest.log。</summary>
static class SelfTest
{
    public static void Run(string[] args)
    {
        string dir = args.Length > 0 ? args[0] : Environment.CurrentDirectory;
        Directory.CreateDirectory(dir);
        var log = new StringBuilder();
        int failed = 0;

        void Check(string name, Func<string?> test)
        {
            try
            {
                var err = test();
                log.AppendLine(err == null ? $"PASS  {name}" : $"FAIL  {name}: {err}");
                if (err != null) failed++;
            }
            catch (Exception ex)
            {
                log.AppendLine($"FAIL  {name}: {ex}");
                failed++;
            }
        }

        Check("拼接：带固定顶栏/底栏/滚动条/空白段", () => StitchTest(header: 40, footer: 30, steps: [120, 120, 93, 200, 150, 77, 300, 260, 400, 333]));
        Check("拼接：无固定栏，小步滚动", () => StitchTest(header: 0, footer: 0, steps: [40, 40, 41, 60, 35, 90, 100]));
        Check("拼接：滚动过头返回 NoMatch", () =>
        {
            var (page, frame) = MakePage(0, 0);
            var st = new Stitcher(frame(0));
            if (st.Add(frame(0)) != StitchResult.Unchanged) return "相同帧没有返回 Unchanged";
            return st.Add(frame(900)) == StitchResult.NoMatch ? null : "没有重叠时应返回 NoMatch";
        });
        Check("拼接：滚过头断掉后，往回滚能接上继续截", () => StitchSeq(header: 40, footer: 30,
        [
            (150, StitchResult.Appended), (300, StitchResult.Appended),
            (1100, StitchResult.NoMatch), (1250, StitchResult.NoMatch),  // 一下滚太多，断了
            (1100, StitchResult.NoMatch), (700, StitchResult.Appended),  // 往回滚到有重叠的地方，接上
            (850, StitchResult.Appended), (1000, StitchResult.Appended),
        ]));
        Check("拼接：往回滚到很早的位置，再往下滚接着截", () => StitchSeq(header: 0, footer: 20,
        [
            (200, StitchResult.Appended), (400, StitchResult.Appended), (600, StitchResult.Appended),
            (450, StitchResult.Behind), (100, StitchResult.Behind), (0, StitchResult.Behind),
            (300, StitchResult.Behind), (600, StitchResult.Behind), (600, StitchResult.Unchanged), (750, StitchResult.Appended),
        ]));
        Check("拼接：滚动中途出现吸顶栏、鼠标悬停高亮", () => StitchSeq(header: 0, footer: 0,
        [
            (120, StitchResult.Appended), (240, StitchResult.Appended), (360, StitchResult.Appended),
            (480, StitchResult.Appended), (600, StitchResult.Appended), (720, StitchResult.Appended),
        ], sticky: 60, hover: true));
        Check("拼接：画面里有一大块动图一直在变，照样能接上；页面不动时也不会把它上下当成固定栏", () => StitchSeq(header: 40, footer: 30,
        [
            (200, StitchResult.Appended), (400, StitchResult.Appended), (600, StitchResult.Appended), (800, StitchResult.Appended),
            (800, StitchResult.Unchanged), (800, StitchResult.Unchanged), (800, StitchResult.Unchanged),
            (1000, StitchResult.Appended), (1200, StitchResult.Appended), (1400, StitchResult.Appended),
        ], anim: (900, 1100)));
        Check("拼接：空白比截图区域还高，手动滚（不知道滚了多少）也能接过去", () => StitchSeq(header: 0, footer: 0,
        [
            (200, StitchResult.Appended), (400, StitchResult.Appended), (600, StitchResult.Appended), (800, StitchResult.Appended),
            (1000, StitchResult.Blank), (1300, StitchResult.Blank), (1600, StitchResult.Appended), (1800, StitchResult.Appended), (2000, StitchResult.Appended),
        ], blank: (900, 2000), compressAt: 1400, compress: 604)); // 空白 900~2000 被缩短到 900~1400
        Check("拼接：空白比截图区域还高，自动滚（有预计位移）空白长度不变", () => StitchSeq(header: 40, footer: 30,
        [
            (200, StitchResult.Appended), (400, StitchResult.Appended), (600, StitchResult.Appended), (800, StitchResult.Appended),
            (1000, StitchResult.Blank), (1300, StitchResult.Blank), (1600, StitchResult.Appended), (1800, StitchResult.Appended), (2000, StitchResult.Appended),
        ], blank: (900, 2000), estimate: true));
        Check("拼接：空白里的加载圈在转（页面没动），不会被当成新内容一遍遍接上", () =>
        {
            const int W = 400;
            var (_, plain) = MakePage(0, 0, (900, 2400));
            var rnd = new Random(5);
            RawImage frame(int o)
            {
                var f = plain(o);
                if (o >= 1200) // 滚到空白处才出现的加载圈，每一帧都不一样
                    for (int y = 540; y < 556; y++) for (int x = 180; x < 220; x++) f.Pixels[(y * W + x) * 4 + 1] = (byte)rnd.Next(256);
                return f;
            }
            var st = new Stitcher(frame(400));
            if (st.Add(frame(600)) != StitchResult.Appended) return "第一步没接上";
            st.Add(frame(1200)); // 第一次看到加载圈：当成空白后面的新内容接上，没法分辨
            int h = st.Height;
            for (int i = 0; i < 8; i++)
            {
                var r = st.Add(frame(1200));
                if (r != StitchResult.Unchanged) return $"第 {i + 1} 次结果 {r}，应为 Unchanged（{st.LastDebug}）";
            }
            return st.Height == h ? null : $"高度从 {h} 变成了 {st.Height}";
        });
        Check("拼接：接不上时跳过，留下标记，后面照样接着截", () =>
        {
            const int W = 400;
            var (page, frame) = MakePage(0, 0);
            var st = new Stitcher(frame(0));
            var marker = new RawImage(W, 12, Enumerable.Repeat((byte)77, W * 12 * 4).ToArray());
            var seq = new (int, StitchResult)[] { (200, StitchResult.Appended), (400, StitchResult.Appended), (1500, StitchResult.NoMatch), (1500, StitchResult.NoMatch) };
            foreach (var (o, expect) in seq)
                if (st.Add(frame(o)) is var r && r != expect) return $"偏移 {o} 处结果 {r}，应为 {expect}";
            if (st.Skip(frame(1500), marker) != StitchResult.Skipped) return "跳过没有返回 Skipped";
            foreach (int o in new[] { 1700, 1900 })
                if (st.Add(frame(o)) is var r && r != StitchResult.Appended) return $"跳过以后偏移 {o} 处结果 {r}（{st.LastDebug}）";
            if (st.Add(frame(1600)) is var back && back != StitchResult.Behind) return $"跳过以后往回滚结果 {back}";
            var img = st.Build();
            if (img.Height != 1000 + 12 + 1000 || st.Skips != 1) return $"高度 {img.Height}，应为 2012";
            for (int y = 0; y < img.Height; y++)
            {
                int py = y < 1000 ? y : y < 1012 ? -1 : y - 1012 + 1500;
                for (int x = 0; x < W - 24; x++)
                {
                    int i = (y * W + x) * 4;
                    byte want = py < 0 ? (byte)77 : page.Pixels[(py * W + x) * 4];
                    if (img.Pixels[i] != want) return $"像素不一致 ({x},{y})";
                }
            }
            return null;
        });
        Check("拼接：跳过的标记能画出来", () =>
        {
            var m = LongCaptureSession.MakeMarker(500, 1.5);
            File.WriteAllBytes(System.IO.Path.Combine(dir, "skip_marker.png"), ImageExport.EncodeSimple(m.ToBitmapSource(), ExportFormat.Png));
            return m.Width == 500 && m.Height == 51 ? null : $"尺寸 {m.Width}×{m.Height}";
        });

        Check("截屏：整个虚拟桌面", () =>
        {
            var v = ScreenCapture.VirtualScreen;
            var shot = ScreenCapture.CaptureVirtualScreen();
            File.WriteAllBytes(System.IO.Path.Combine(dir, "screen.png"), ImageExport.EncodeSimple(shot.ToBitmapSource(), ExportFormat.Png));
            log.AppendLine($"      虚拟桌面 {v.X},{v.Y} {v.Width}×{v.Height}");
            return shot.Width == v.Width && shot.Height == v.Height ? null : "尺寸不一致";
        });

        Check("窗口识别", () =>
        {
            var list = WindowFinder.GetWindowRects(ScreenCapture.VirtualScreen);
            log.AppendLine($"      找到 {list.Count} 个窗口");
            return list.Count > 0 ? null : "一个窗口都没找到";
        });

        var tall = MakeTallBitmap(1200, 5000);
        Check("导出：JPG 限制 300KB", () =>
        {
            var o = new ExportOptions(1200, 5000, BitmapScalingMode.HighQuality, 96, ExportFormat.Jpg, 95, 300 * 1024, PdfPageMode.Original);
            var r = ImageExport.Export((w, h) => Scale(tall, w, h), o);
            File.WriteAllBytes(System.IO.Path.Combine(dir, "limit.jpg"), r.Data);
            log.AppendLine($"      {r.Width}×{r.Height} q={r.Quality} {ImageExport.FormatSize(r.Data.Length)}");
            return r.LimitMet && r.Data.Length <= 300 * 1024 ? null : $"超出限制：{r.Data.Length}";
        });
        Check("导出：PNG 限制 200KB（自动缩小尺寸）", () =>
        {
            var o = new ExportOptions(1200, 5000, BitmapScalingMode.HighQuality, 96, ExportFormat.Png, 90, 200 * 1024, PdfPageMode.Original);
            var r = ImageExport.Export((w, h) => Scale(tall, w, h), o);
            log.AppendLine($"      {r.Width}×{r.Height} {ImageExport.FormatSize(r.Data.Length)}");
            return r.LimitMet && r.Width < 1200 ? null : $"未满足：{r.Data.Length}";
        });
        Check("导出：PDF A4 分页", () =>
        {
            var data = PdfBuilder.Build(tall, 85, PdfPageMode.A4Portrait, 96, out int pages);
            File.WriteAllBytes(System.IO.Path.Combine(dir, "long.pdf"), data);
            var text = Encoding.ASCII.GetString(data);
            int pageObjs = text.Split("/Type /Page ").Length - 1;
            log.AppendLine($"      {pages} 页，{ImageExport.FormatSize(data.Length)}");
            if (!text.StartsWith("%PDF-1.4") || !text.TrimEnd().EndsWith("%%EOF")) return "PDF 头尾不对";
            return pages > 1 && pageObjs == pages ? null : $"页数 {pages} / 页对象 {pageObjs}";
        });
        Check("导出：DPI 写入 PNG", () =>
        {
            var data = ImageExport.Encode(tall, ExportFormat.Png, 90, 300, PdfPageMode.Original, out _);
            var frame = BitmapDecoder.Create(new MemoryStream(data), BitmapCreateOptions.None, BitmapCacheOption.OnLoad).Frames[0];
            return Math.Abs(frame.DpiX - 300) < 1 ? null : $"DPI = {frame.DpiX}";
        });

        Check("编辑器：标注合成与缩放导出", () =>
        {
            var src = MakeTallBitmap(400, 300);
            var editor = new EditorWindow(src) { ShowActivated = false, Left = -3000, Top = -3000 };
            editor.Show();
            var rect = new Rectangle
            {
                Width = 200, Height = 100, StrokeThickness = 10,
                Stroke = new SolidColorBrush(Color.FromRgb(255, 0, 0)),
                Tag = new AnnotationInfo(Tool.Rect, Colors.Red),
                RenderTransform = new TranslateTransform(),
            };
            Canvas.SetLeft(rect, 100);
            Canvas.SetTop(rect, 100);
            editor.Ink.Children.Add(rect);
            editor.UpdateLayout();
            var full = editor.Render(400, 300, BitmapScalingMode.HighQuality);
            var half = editor.Render(200, 150, BitmapScalingMode.HighQuality);
            editor.Close();
            File.WriteAllBytes(System.IO.Path.Combine(dir, "editor_half.png"), ImageExport.EncodeSimple(half, ExportFormat.Png));
            var a = Pixel(full, 105, 150);
            var b = Pixel(half, 52, 75);
            if (full.PixelWidth != 400 || half.PixelWidth != 200) return "尺寸不对";
            return a.R > 200 && a.G < 60 && b.R > 180 && b.G < 90 ? null : $"红框颜色不对：原尺寸 {a}，缩小后 {b}";
        });

        if (args.Contains("--ui"))
        {
            Check("界面：主窗口与编辑器渲染", () =>
            {
                var main = new MainWindow { ShowActivated = false };
                main.Show();
                main.Left = -4000; main.Top = -4000;
                SaveWindow(main, System.IO.Path.Combine(dir, "ui_main.png"));
                main.Hide();

                var settings = new SettingsWindow { ShowActivated = false, Left = -4000, Top = -4000 };
                settings.Show();
                SaveWindow(settings, System.IO.Path.Combine(dir, "ui_settings.png"));
                settings.Close();

                // 截图浮层只构造不显示（显示会盖住整个桌面），单独渲染它的工具条
                var shot = new RawImage(800, 600, new byte[800 * 600 * 4]);
                var overlay = new CaptureOverlay(shot, new Int32Rect(0, 0, 800, 600), [], longMode: false);
                SaveElement(overlay.ToolbarForTest, System.IO.Path.Combine(dir, "ui_overlay_toolbar.png"));
                var longOverlay = new CaptureOverlay(shot, new Int32Rect(0, 0, 800, 600), [], longMode: true);
                SaveElement(longOverlay.GuideForTest!, System.IO.Path.Combine(dir, "ui_long_guide.png"));
                var trayMenu = new TrayMenu(
                [
                    new("", "区域截图", "Ctrl+Alt+X", () => { }),
                    new("", "长截图", "Ctrl+Alt+L", () => { }),
                    null,
                    new("", "设置", "", () => { }),
                    new("", "退出", "", () => { }),
                ]);
                SaveElement((FrameworkElement)trayMenu.Content, System.IO.Path.Combine(dir, "ui_tray_menu.png"));
                var longBar = new LongCaptureBar(new Int32Rect(0, 0, 400, 400));
                longBar.Update(2480, false, StitchResult.Unchanged, stuck: true);
                SaveElement((FrameworkElement)longBar.Content, System.IO.Path.Combine(dir, "ui_long_bar.png"));
                var skipBar = new LongCaptureBar(new Int32Rect(0, 0, 400, 400));
                skipBar.Update(5320, false, StitchResult.NoMatch, skips: 1, skipIn: TimeSpan.FromSeconds(1.6));
                SaveElement((FrameworkElement)skipBar.Content, System.IO.Path.Combine(dir, "ui_long_bar_skip.png"));
                _ = new CountdownWindow(3);
                _ = new PinWindow(MakeTallBitmap(100, 100));

                var editor = new EditorWindow(MakeTallBitmap(900, 600)) { ShowActivated = false, Left = -4000, Top = -4000 };
                editor.Show();
                editor.UpdateLayout();
                SaveWindow(editor, System.IO.Path.Combine(dir, "ui_editor.png"));
                editor.Close();
                return null;
            });
        }

        if (args.Contains("--ui"))
        {
            Check("界面：编辑器和设置窗口不超出屏幕可用区域", () =>
            {
                string? err = null;
                foreach (Window w in new Window[] { new EditorWindow(MakeTallBitmap(1800, 1200)), new SettingsWindow() })
                {
                    w.Show();
                    w.UpdateLayout();
                    System.Windows.Threading.Dispatcher.CurrentDispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.ApplicationIdle);
                    Native.GetWindowRect(w.Handle(), out var r);
                    var work = Native.WorkAreaAt((r.Left + r.Right) / 2, (r.Top + r.Bottom) / 2);
                    log.AppendLine($"      {w.GetType().Name} ({w.WindowState}): {r.Left},{r.Top}-{r.Right},{r.Bottom}  可用区域 {work.Left},{work.Top}-{work.Right},{work.Bottom}");
                    if (w.WindowState == WindowState.Maximized)
                    {
                        // 最大化必须铺满可用区域（窗口矩形会比屏幕大出一圈边框）
                        if (r.Left > work.Left || r.Top > work.Top || r.Right < work.Right || r.Bottom < work.Bottom)
                            err ??= $"{w.GetType().Name} 最大化后没有铺满屏幕";
                    }
                    // Win11 窗口四周有约 7px 看不见的阴影边，允许这点误差
                    else if (r.Top < work.Top - 1 || r.Bottom > work.Bottom + 10 || r.Left < work.Left - 10 || r.Right > work.Right + 10)
                        err ??= $"{w.GetType().Name} 超出了屏幕";
                    w.Close();
                }
                return err;
            });
        }

        log.AppendLine(failed == 0 ? "ALL PASSED" : $"{failed} FAILED");
        File.WriteAllText(System.IO.Path.Combine(dir, "selftest.log"), log.ToString(), Encoding.UTF8);
    }

    // 生成一个"网页"：每行内容不同，中间有一段空白，再加固定顶栏/底栏和会变化的滚动条
    static (RawImage Page, Func<int, RawImage> Frame) MakePage(int header, int footer, (int From, int To)? blankRange = null)
    {
        const int W = 400, PageH = 3000, ViewH = 600;
        var (b0, b1) = blankRange ?? (500, 700);
        var page = new byte[W * PageH * 4];
        var rnd = new Random(42);
        for (int y = 0; y < PageH; y++)
        {
            bool blank = y >= b0 && y < b1 || y % 37 < 6;
            for (int x = 0; x < W; x++)
            {
                int i = (y * W + x) * 4;
                byte v = blank ? (byte)255 : (byte)rnd.Next(256);
                page[i] = v; page[i + 1] = blank ? v : (byte)(v ^ y); page[i + 2] = blank ? v : (byte)(x + y); page[i + 3] = 255;
            }
        }
        var pageImg = new RawImage(W, PageH, page);
        int contentH = ViewH - header - footer;

        RawImage Frame(int offset)
        {
            var px = new byte[W * ViewH * 4];
            for (int y = 0; y < ViewH; y++)
            for (int x = 0; x < W; x++)
            {
                int i = (y * W + x) * 4;
                if (y < header) { px[i] = 200; px[i + 1] = 30; px[i + 2] = (byte)x; }
                else if (y >= ViewH - footer) { px[i] = 30; px[i + 1] = 200; px[i + 2] = (byte)x; }
                else Array.Copy(page, ((offset + y - header) * W + x) * 4, px, i, 3);
                px[i + 3] = 255;
                if (x >= W - 12) px[i] = px[i + 1] = px[i + 2] = (byte)((offset / 7 + y) % 256); // 滚动条随位置变化
            }
            return new RawImage(W, ViewH, px);
        }
        _ = contentH;
        return (pageImg, Frame);
    }

    static string? StitchTest(int header, int footer, int[] steps)
    {
        var seq = new List<(int, StitchResult)>();
        int offset = 0;
        foreach (var s in steps) seq.Add((offset += s, StitchResult.Appended));
        return StitchSeq(header, footer, seq);
    }

    /// <param name="sticky">偏移超过 250 后，顶部出现这么高的吸顶栏</param>
    /// <param name="hover">画面中间固定位置有一段“悬停高亮”，每帧颜色都不一样</param>
    /// <param name="anim">页面上这一段（页面坐标）是动图，每一帧都不一样</param>
    /// <param name="blank">页面上这一段（页面坐标）是空白</param>
    /// <param name="estimate">像自动滚动那样给出预计位移</param>
    /// <param name="compressAt">空白被缩短：结果里（不含顶栏）这一行以后的内容，在页面上还要再往下 compress 行</param>
    static string? StitchSeq(int header, int footer, IEnumerable<(int Offset, StitchResult Expect)> seq, int sticky = 0, bool hover = false,
        (int From, int To)? anim = null, (int From, int To)? blank = null, bool estimate = false, int compressAt = int.MaxValue, int compress = 0)
    {
        const int W = 400, ViewH = 600;
        var (page, plain) = MakePage(header, footer, blank);
        var rnd = new Random(9);
        int n = 0;
        RawImage frame(int offset)
        {
            var f = plain(offset);
            n++;
            for (int y = 0; y < ViewH; y++)
            for (int x = 0; x < W; x++)
            {
                int i = (y * W + x) * 4, py = offset + y - header;
                if (sticky > 0 && offset > 250 && y < sticky) { f.Pixels[i] = 90; f.Pixels[i + 1] = (byte)x; f.Pixels[i + 2] = 160; }
                else if (hover && y is >= 280 and < 300) f.Pixels[i + 1] = (byte)(f.Pixels[i + 1] + 40 * n);
                else if (anim is var (a0, a1) && y >= header && y < ViewH - footer && py >= a0 && py < a1)
                    f.Pixels[i] = f.Pixels[i + 1] = (byte)rnd.Next(256);
            }
            return f;
        }
        var st = new Stitcher(frame(0));
        int offset = 0, located = 0;
        foreach (var (o, expect) in seq)
        {
            var r = st.Add(frame(o), estimate ? o - located : null);
            if (r != expect) return $"偏移 {o} 处结果 {r}，应为 {expect}（{st.LastDebug}）";
            if (r is StitchResult.Appended or StitchResult.Unchanged or StitchResult.Behind) located = o;
            if (r == StitchResult.Appended) offset = Math.Max(offset, o);
        }
        int contentH = ViewH - header - footer;
        if (sticky == 0 && st.ContentHeight != contentH) return $"固定栏认错了：可比区域 {st.ContentHeight}，应为 {contentH}";
        var result = st.Build();
        int expectH = header + offset + contentH + footer - compress;
        if (result.Height != expectH) return $"高度 {result.Height}，应为 {expectH}";

        var last = plain(offset);
        for (int y = 0; y < expectH; y++)
        for (int x = 0; x < W - 24; x++)
        {
            if (hover && y is >= 280 and < 300) continue; // 第一帧里本来就带着高亮
            int py = y - header >= compressAt ? y - header + compress : y - header;
            if (anim is var (a0, a1) && py >= a0 && py < a1) continue;
            int i = (y * W + x) * 4;
            byte er, eg, eb;
            if (y < header) (eb, eg, er) = ((byte)200, (byte)30, (byte)x);
            else if (y >= expectH - footer)
            {
                int fy = ViewH - (expectH - y);
                int fi = (fy * W + x) * 4;
                (eb, eg, er) = (last.Pixels[fi], last.Pixels[fi + 1], last.Pixels[fi + 2]);
            }
            else
            {
                int pi = (py * W + x) * 4;
                (eb, eg, er) = (page.Pixels[pi], page.Pixels[pi + 1], page.Pixels[pi + 2]);
            }
            if (result.Pixels[i] != eb || result.Pixels[i + 1] != eg || result.Pixels[i + 2] != er)
                return $"像素不一致 ({x},{y})";
        }
        return null;
    }

    static BitmapSource MakeTallBitmap(int w, int h)
    {
        var px = new byte[w * h * 4];
        var rnd = new Random(1);
        for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++)
        {
            int i = (y * w + x) * 4;
            bool text = (y / 18) % 2 == 0 && (x / 7 + y / 18) % 5 != 0 && rnd.Next(3) > 0;
            byte v = text ? (byte)40 : (byte)245;
            px[i] = px[i + 1] = v;
            px[i + 2] = (byte)(text ? 40 : 250);
            px[i + 3] = 255;
        }
        var b = BitmapSource.Create(w, h, 96, 96, PixelFormats.Bgra32, null, px, w * 4);
        b.Freeze();
        return b;
    }

    static BitmapSource Scale(BitmapSource src, int w, int h)
    {
        if (w == src.PixelWidth && h == src.PixelHeight) return src;
        var t = new TransformedBitmap(src, new ScaleTransform((double)w / src.PixelWidth, (double)h / src.PixelHeight));
        var c = new CroppedBitmap(t, new Int32Rect(0, 0, Math.Min(w, t.PixelWidth), Math.Min(h, t.PixelHeight)));
        c.Freeze();
        return c;
    }

    static void SaveWindow(Window w, string path)
    {
        var root = (FrameworkElement)w.Content;
        root.UpdateLayout();
        int pw = (int)Math.Ceiling(root.ActualWidth), ph = (int)Math.Ceiling(root.ActualHeight);
        var dv = new DrawingVisual();
        using (var dc = dv.RenderOpen())
        {
            var bg = w.AllowsTransparency ? new SolidColorBrush(Color.FromRgb(90, 100, 115)) : Application.Current.TryFindResource("SolidBackgroundFillColorBaseBrush") as Brush ?? Brushes.White;
            dc.DrawRectangle(bg, null, new Rect(0, 0, pw, ph));
            dc.DrawRectangle(new VisualBrush(root), null, new Rect(0, 0, pw, ph));
        }
        var rtb = new RenderTargetBitmap(pw, ph, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(dv);
        File.WriteAllBytes(path, ImageExport.EncodeSimple(rtb, ExportFormat.Png));
    }

    static void SaveElement(FrameworkElement el, string path)
    {
        el.Visibility = Visibility.Visible;
        el.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
        el.Arrange(new Rect(new Point(20, 20), el.DesiredSize));
        int pw = (int)el.DesiredSize.Width + 40, ph = (int)el.DesiredSize.Height + 40;
        var dv = new DrawingVisual();
        using (var dc = dv.RenderOpen())
        {
            dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(90, 100, 115)), null, new Rect(0, 0, pw, ph));
            dc.DrawRectangle(new VisualBrush(el), null, new Rect(20, 20, el.DesiredSize.Width, el.DesiredSize.Height));
        }
        var rtb = new RenderTargetBitmap(pw, ph, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(dv);
        File.WriteAllBytes(path, ImageExport.EncodeSimple(rtb, ExportFormat.Png));
    }

    static Color Pixel(BitmapSource b, int x, int y)
    {
        var px = new byte[4];
        new FormatConvertedBitmap(b, PixelFormats.Bgra32, null, 0).CopyPixels(new Int32Rect(x, y, 1, 1), px, 4, 0);
        return Color.FromRgb(px[2], px[1], px[0]);
    }
}
