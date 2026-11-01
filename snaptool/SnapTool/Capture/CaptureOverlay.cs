using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace SnapTool.Capture;

public enum OverlayAction { Cancel, Edit, Copy, Save, Pin, Long }

/// <summary>
/// 全屏冻结画面上选择区域：拖动框选、单击选中窗口、拖边调整、放大镜取色。
/// 内部坐标一律用截图的物理像素，只在显示时换算成 WPF 的 DIP。
/// </summary>
public sealed class CaptureOverlay : Window
{
    enum DragMode { None, New, Move, Resize }
    const int L = 1, T = 2, R = 4, B = 8;

    readonly RawImage _shot;
    readonly BitmapSource _bmp;
    readonly Int32Rect _virt;
    readonly List<Int32Rect> _windows;
    readonly bool _longMode;

    readonly Grid _root = new();
    readonly Canvas _layer = new() { IsHitTestVisible = false };
    readonly Canvas _ui = new();
    readonly Path _mask = new() { Fill = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0x78, 0, 0, 0))) };
    readonly Rectangle _frame = new() { Stroke = UiKit.AccentBrush, StrokeThickness = 2, SnapsToDevicePixels = true };
    readonly Border _sizeTag;
    readonly TextBlock _sizeText = new() { Foreground = Brushes.White, FontSize = 12 };
    readonly Border _magnifier;
    readonly Rectangle _magView = new() { Width = 155, Height = 105 };
    readonly TextBlock _magText = new() { Foreground = Brushes.White, FontSize = 12, Margin = new Thickness(6, 4, 6, 2) };
    readonly Border _toolbar;

    Int32Rect? _sel;
    Int32Rect? _hover;
    DragMode _drag;
    Point _downPx, _downDip;
    bool _moved;
    Int32Rect _origSel;
    int _edges;
    Point _mousePx;

    internal Border ToolbarForTest => _toolbar;

    // 长截图模式下屏幕上方的步骤说明
    Border? _guide;
    internal Border? GuideForTest => _guide;
    readonly TextBlock[] _guideSteps = new TextBlock[3];
    Native.RECT _guideMonitor;

    public OverlayAction Action { get; private set; } = OverlayAction.Cancel;
    public BitmapSource? Result { get; private set; }
    /// <summary>选区在屏幕上的位置（物理像素）。</summary>
    public Int32Rect ScreenSelection { get; private set; }

    public CaptureOverlay(RawImage shot, Int32Rect virt, List<Int32Rect> windows, bool longMode)
    {
        _shot = shot;
        _bmp = shot.ToBitmapSource();
        _virt = virt;
        _windows = windows;
        _longMode = longMode;

        ThemeMode = ThemeMode.None;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        Topmost = true;
        Background = Brushes.Black;
        WindowStartupLocation = WindowStartupLocation.Manual;
        Left = virt.X; Top = virt.Y; Width = virt.Width; Height = virt.Height;
        Cursor = Cursors.Cross;
        UseLayoutRounding = true;
        Title = "SnapTool 截图";

        var image = new Image { Source = _bmp, Stretch = Stretch.Fill };
        RenderOptions.SetBitmapScalingMode(image, BitmapScalingMode.NearestNeighbor);
        _root.Children.Add(image);
        _root.Children.Add(_layer);
        _root.Children.Add(_ui);
        Content = _root;

        _layer.Children.Add(_mask);
        _layer.Children.Add(_frame);

        _sizeTag = new Border
        {
            Background = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0xD0, 0x1F, 0x1F, 0x23))),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(6, 2, 6, 2),
            Child = _sizeText,
        };
        _layer.Children.Add(_sizeTag);

        // 放大镜：显示光标周围 31×21 个像素，每个像素放大 5 倍
        RenderOptions.SetBitmapScalingMode(_magView, BitmapScalingMode.NearestNeighbor);
        _magView.Fill = new ImageBrush(_bmp) { ViewboxUnits = BrushMappingMode.Absolute, Stretch = Stretch.Fill };
        var magGrid = new Grid { Width = 155, Height = 105, ClipToBounds = true };
        magGrid.Children.Add(_magView);
        var crossBrush = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0x70, 0x3B, 0x82, 0xF6)));
        magGrid.Children.Add(new Rectangle { Width = 5, Fill = crossBrush, HorizontalAlignment = HorizontalAlignment.Center });
        magGrid.Children.Add(new Rectangle { Height = 5, Fill = crossBrush, VerticalAlignment = VerticalAlignment.Center });
        var magStack = new StackPanel();
        magStack.Children.Add(magGrid);
        magStack.Children.Add(_magText);
        _magnifier = new Border
        {
            Background = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0xE8, 0x1F, 0x1F, 0x23))),
            BorderBrush = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0x60, 0xFF, 0xFF, 0xFF))),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(6),
            Child = magStack,
            Width = 157,
        };
        _layer.Children.Add(_magnifier);

        _toolbar = UiKit.Panel(BuildToolbar());
        _toolbar.Visibility = Visibility.Collapsed;
        _ui.Children.Add(_toolbar);
        if (_longMode) BuildGuide();

        SourceInitialized += (_, _) =>
        {
            HwndSource.FromHwnd(this.Handle())!.AddHook(WndProc);
            PlaceOverVirtualScreen();
        };
        Loaded += (_, _) =>
        {
            PlaceOverVirtualScreen();
            Activate();
            Native.SetForegroundWindow(this.Handle());
            Focus();
            Keyboard.Focus(this);
            UpdateVisuals();
        };
        SizeChanged += (_, _) => UpdateVisuals();
    }

    void PlaceOverVirtualScreen() =>
        Native.PlaceWindow(this.Handle(), _virt.X, _virt.Y, _virt.Width, _virt.Height);

    IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        // 跨不同缩放比例的显示器时，不让系统按 DPI 改变窗口大小，始终覆盖整个虚拟桌面
        if (msg == Native.WM_DPICHANGED)
        {
            handled = true;
            Dispatcher.BeginInvoke(PlaceOverVirtualScreen);
        }
        return IntPtr.Zero;
    }

    void BuildGuide()
    {
        var stack = new StackPanel { Margin = new Thickness(14, 8, 14, 8) };
        stack.Children.Add(new TextBlock
        {
            Text = "长截图",
            FontSize = 16,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 0, 0, 6),
        });
        string[] steps =
        [
            "① 框选要往下滚动的内容（比如网页正文），或单击直接选中整个窗口",
            "② 点「开始长截图」（或按 Enter）",
            "③ 程序会自动往下滚动并拼接，滚到底自动结束，然后打开编辑窗口",
        ];
        for (int i = 0; i < steps.Length; i++)
        {
            _guideSteps[i] = new TextBlock { Text = steps[i], FontSize = 14, Foreground = Brushes.White, Margin = new Thickness(0, 2, 0, 2) };
            stack.Children.Add(_guideSteps[i]);
        }
        stack.Children.Add(new TextBlock
        {
            Text = "滚动过程中可以随时按 Esc 或点「完成」提前结束；动一下鼠标就改为自己用滚轮滚",
            FontSize = 12,
            Foreground = Brushes.White,
            Opacity = 0.6,
            Margin = new Thickness(0, 6, 0, 0),
        });
        _guide = UiKit.Panel(stack);
        _guide.IsHitTestVisible = false;
        _ui.Children.Add(_guide);

        Native.GetCursorPos(out var p);
        _guideMonitor = Native.WorkAreaAt(p.X, p.Y);
    }

    void PlaceGuide(Int32Rect? shown)
    {
        if (_guide == null) return;
        int step = _sel == null ? 0 : 1;
        for (int i = 0; i < _guideSteps.Length; i++)
        {
            _guideSteps[i].Opacity = i == step ? 1 : 0.45;
            _guideSteps[i].FontWeight = i == step ? FontWeights.SemiBold : FontWeights.Normal;
        }

        _guide.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
        var size = _guide.DesiredSize;
        var mon = new Rect(
            (_guideMonitor.Left - _virt.X) * K, (_guideMonitor.Top - _virt.Y) * K,
            _guideMonitor.Width * K, (_guideMonitor.Bottom - _guideMonitor.Top) * K);
        double x = mon.Left + (mon.Width - size.Width) / 2;
        var top = new Rect(x, mon.Top + 24, size.Width, size.Height);

        // 说明挡住了选区或鼠标时，挪到屏幕下方
        var mouse = new Point(_mousePx.X * K, _mousePx.Y * K);
        bool blocked = top.Contains(mouse) || (shown is { } s && top.IntersectsWith(ToDip(s)));
        double y = blocked ? mon.Bottom - size.Height - 24 : top.Top;
        if (blocked && shown is { } s2 && new Rect(x, y, size.Width, size.Height).IntersectsWith(ToDip(s2)))
        {
            _guide.Visibility = Visibility.Collapsed; // 上下都会挡住选区，就先不显示
            return;
        }
        _guide.Visibility = Visibility.Visible;
        Canvas.SetLeft(_guide, x);
        Canvas.SetTop(_guide, y);
    }

    StackPanel BuildToolbar()
    {
        var bar = new StackPanel { Orientation = Orientation.Horizontal };
        if (_longMode)
        {
            bar.Children.Add(UiKit.Chip("", "取消", Cancel));
            bar.Children.Add(UiKit.Chip("", "开始长截图", () => Finish(OverlayAction.Long), accent: true));
        }
        else
        {
            bar.Children.Add(UiKit.Chip("", "", () => Finish(OverlayAction.Edit), tooltip: "标注 / 改尺寸 / 导出 PDF"));
            bar.Children.Add(UiKit.Chip("", "", () => Finish(OverlayAction.Long), tooltip: "从这个区域开始长截图"));
            bar.Children.Add(UiKit.Chip("", "", () => Finish(OverlayAction.Pin), tooltip: "钉在桌面上"));
            bar.Children.Add(UiKit.Chip("", "", () => Finish(OverlayAction.Save), tooltip: "保存 (Ctrl+S)"));
            bar.Children.Add(UiKit.Divider());
            bar.Children.Add(UiKit.Chip("", "", Cancel, tooltip: "取消 (Esc)"));
            bar.Children.Add(UiKit.Chip("", "", () => Finish(OverlayAction.Copy), accent: true, tooltip: "复制并完成 (Enter / 双击)"));
        }
        return bar;
    }

    // ---------------- 坐标换算 ----------------

    double K => _root.ActualWidth > 0 ? _root.ActualWidth / _shot.Width : 1; // 每个像素多少 DIP

    Point ToPx(Point dip) => new(
        Math.Clamp(Math.Floor(dip.X / K), 0, _shot.Width - 1),
        Math.Clamp(Math.Floor(dip.Y / K), 0, _shot.Height - 1));

    Rect ToDip(Int32Rect r) => new(r.X * K, r.Y * K, r.Width * K, r.Height * K);

    static Int32Rect FromCorners(Point a, Point b)
    {
        int x1 = (int)Math.Min(a.X, b.X), y1 = (int)Math.Min(a.Y, b.Y);
        int x2 = (int)Math.Max(a.X, b.X), y2 = (int)Math.Max(a.Y, b.Y);
        return new Int32Rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    }

    static bool Contains(Int32Rect r, Point p) =>
        p.X >= r.X && p.X < r.X + r.Width && p.Y >= r.Y && p.Y < r.Y + r.Height;

    int HitEdges(Int32Rect r, Point p)
    {
        double tol = 6 / K;
        double x2 = r.X + r.Width, y2 = r.Y + r.Height;
        bool inX = p.X >= r.X - tol && p.X <= x2 + tol;
        bool inY = p.Y >= r.Y - tol && p.Y <= y2 + tol;
        int e = 0;
        if (inY && Math.Abs(p.X - r.X) <= tol) e |= L;
        if (inY && Math.Abs(p.X - x2) <= tol) e |= R;
        if (inX && Math.Abs(p.Y - r.Y) <= tol) e |= T;
        if (inX && Math.Abs(p.Y - y2) <= tol) e |= B;
        return e;
    }

    static Cursor CursorFor(int edges) => edges switch
    {
        L | T or R | B => Cursors.SizeNWSE,
        R | T or L | B => Cursors.SizeNESW,
        L or R => Cursors.SizeWE,
        T or B => Cursors.SizeNS,
        _ => Cursors.Cross,
    };

    Int32Rect? WindowAt(Point p)
    {
        foreach (var r in _windows)
            if (Contains(r, p)) return r;
        return null;
    }

    // ---------------- 鼠标 ----------------

    protected override void OnMouseMove(MouseEventArgs e)
    {
        var dip = e.GetPosition(_root);
        var p = ToPx(dip);
        _mousePx = p;

        switch (_drag)
        {
            case DragMode.New:
                if (!_moved && (dip - _downDip).Length > 4) _moved = true;
                if (_moved) _sel = FromCorners(_downPx, p);
                break;

            case DragMode.Move:
            {
                int x = (int)Math.Clamp(_origSel.X + p.X - _downPx.X, 0, _shot.Width - _origSel.Width);
                int y = (int)Math.Clamp(_origSel.Y + p.Y - _downPx.Y, 0, _shot.Height - _origSel.Height);
                _sel = new Int32Rect(x, y, _origSel.Width, _origSel.Height);
                break;
            }

            case DragMode.Resize:
            {
                double x1 = _origSel.X, y1 = _origSel.Y, x2 = _origSel.X + _origSel.Width - 1, y2 = _origSel.Y + _origSel.Height - 1;
                if ((_edges & L) != 0) x1 = p.X;
                if ((_edges & R) != 0) x2 = p.X;
                if ((_edges & T) != 0) y1 = p.Y;
                if ((_edges & B) != 0) y2 = p.Y;
                _sel = FromCorners(new Point(x1, y1), new Point(x2, y2));
                break;
            }

            default:
                if (_sel is { } s)
                {
                    int edges = HitEdges(s, p);
                    Cursor = edges != 0 ? CursorFor(edges) : Contains(s, p) ? Cursors.SizeAll : Cursors.Cross;
                }
                else
                {
                    _hover = WindowAt(p);
                }
                break;
        }
        UpdateVisuals();
    }

    protected override void OnMouseLeftButtonDown(MouseButtonEventArgs e)
    {
        var dip = e.GetPosition(_root);
        var p = ToPx(dip);

        if (e.ClickCount == 2 && _sel is { } sel2 && Contains(sel2, p))
        {
            Finish(_longMode ? OverlayAction.Long : OverlayAction.Copy);
            return;
        }

        _toolbar.Visibility = Visibility.Collapsed;
        _downPx = p;
        _downDip = dip;
        _moved = false;

        if (_sel is { } sel)
        {
            int edges = HitEdges(sel, p);
            if (edges != 0) { _drag = DragMode.Resize; _edges = edges; _origSel = sel; }
            else if (Contains(sel, p)) { _drag = DragMode.Move; _origSel = sel; }
            else { _sel = null; _hover = WindowAt(p); _drag = DragMode.New; }
        }
        else
        {
            _drag = DragMode.New;
        }
        CaptureMouse();
        UpdateVisuals();
    }

    protected override void OnMouseLeftButtonUp(MouseButtonEventArgs e)
    {
        if (_drag == DragMode.None) return;
        ReleaseMouseCapture();
        if (_drag == DragMode.New && !_moved)
            _sel = _hover ?? new Int32Rect(0, 0, _shot.Width, _shot.Height); // 单击 = 选中鼠标下的窗口
        _drag = DragMode.None;

        if (_sel is { Width: < 3 } or { Height: < 3 }) _sel = null;
        if (_sel != null) ShowToolbar();
        UpdateVisuals();
    }

    protected override void OnMouseRightButtonUp(MouseButtonEventArgs e)
    {
        if (_sel != null && _drag == DragMode.None)
        {
            _sel = null;
            _toolbar.Visibility = Visibility.Collapsed;
            _hover = WindowAt(ToPx(e.GetPosition(_root)));
            Cursor = Cursors.Cross;
            UpdateVisuals();
        }
        else
        {
            Cancel();
        }
    }

    protected override void OnKeyDown(KeyEventArgs e)
    {
        bool ctrl = Keyboard.Modifiers.HasFlag(ModifierKeys.Control);
        switch (e.Key)
        {
            case Key.Escape:
                Cancel();
                break;
            case Key.Enter when _sel != null:
                Finish(_longMode ? OverlayAction.Long : OverlayAction.Copy);
                break;
            case Key.C when ctrl && _sel != null:
                Finish(OverlayAction.Copy);
                break;
            case Key.S when ctrl && _sel != null:
                Finish(OverlayAction.Save);
                break;
            case Key.C when !ctrl && _sel == null:
                // 取色：复制光标处颜色的十六进制值
                var c = _shot.GetPixel((int)_mousePx.X, (int)_mousePx.Y);
                Clipboard.SetText($"#{c.R:X2}{c.G:X2}{c.B:X2}");
                App.Current.Tray.Notify($"已复制颜色 #{c.R:X2}{c.G:X2}{c.B:X2}");
                Cancel();
                break;
            case Key.Left or Key.Right or Key.Up or Key.Down when _sel is { } s:
                // 方向键微调选区位置，Shift + 方向键调整大小
                int dx = e.Key == Key.Left ? -1 : e.Key == Key.Right ? 1 : 0;
                int dy = e.Key == Key.Up ? -1 : e.Key == Key.Down ? 1 : 0;
                if (Keyboard.Modifiers.HasFlag(ModifierKeys.Shift))
                    _sel = new Int32Rect(s.X, s.Y, Math.Clamp(s.Width + dx, 3, _shot.Width - s.X), Math.Clamp(s.Height + dy, 3, _shot.Height - s.Y));
                else
                    _sel = new Int32Rect(Math.Clamp(s.X + dx, 0, _shot.Width - s.Width), Math.Clamp(s.Y + dy, 0, _shot.Height - s.Height), s.Width, s.Height);
                ShowToolbar();
                UpdateVisuals();
                break;
            default:
                return;
        }
        e.Handled = true;
    }

    // ---------------- 结束 ----------------

    void Cancel()
    {
        Action = OverlayAction.Cancel;
        Close();
    }

    void Finish(OverlayAction action)
    {
        if (_sel is not { } s) return;
        Action = action;
        ScreenSelection = new Int32Rect(s.X + _virt.X, s.Y + _virt.Y, s.Width, s.Height);
        if (action != OverlayAction.Long) Result = _shot.Crop(s).ToBitmapSource();
        Close();
    }

    // ---------------- 绘制 ----------------

    void ShowToolbar()
    {
        if (_sel is not { } s) return;
        _toolbar.Visibility = Visibility.Visible;
        _toolbar.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
        var size = _toolbar.DesiredSize;
        var r = ToDip(s);
        double W = _root.ActualWidth, H = _root.ActualHeight;

        double x = Math.Clamp(r.Right - size.Width, 0, Math.Max(0, W - size.Width));
        double y = r.Bottom + 8;
        if (y + size.Height > H) y = r.Top - size.Height - 8;     // 下方放不下就放上方
        if (y < 0) y = Math.Max(0, r.Bottom - size.Height - 8);   // 都放不下就放在选区内
        Canvas.SetLeft(_toolbar, x);
        Canvas.SetTop(_toolbar, y);
    }

    void UpdateVisuals()
    {
        double W = _root.ActualWidth, H = _root.ActualHeight;
        if (W <= 0) return;

        var shown = _sel ?? (_drag == DragMode.None || !_moved ? _hover : null);
        var full = new RectangleGeometry(new Rect(0, 0, W, H));

        if (shown is { } s)
        {
            var r = ToDip(s);
            _mask.Data = new CombinedGeometry(GeometryCombineMode.Exclude, full, new RectangleGeometry(r));
            _frame.Visibility = Visibility.Visible;
            _frame.Width = r.Width + 2;
            _frame.Height = r.Height + 2;
            Canvas.SetLeft(_frame, r.X - 1);
            Canvas.SetTop(_frame, r.Y - 1);
            _frame.StrokeDashArray = _sel == null ? [3, 2] : null;

            _sizeText.Text = $"{s.Width} × {s.Height}";
            _sizeTag.Visibility = Visibility.Visible;
            Canvas.SetLeft(_sizeTag, r.X);
            Canvas.SetTop(_sizeTag, r.Y >= 26 ? r.Y - 26 : r.Y + 4);
        }
        else
        {
            _mask.Data = full;
            _frame.Visibility = Visibility.Collapsed;
            _sizeTag.Visibility = Visibility.Collapsed;
        }
        PlaceGuide(shown);

        bool showMag = _sel == null || _drag is DragMode.New or DragMode.Resize;
        _magnifier.Visibility = showMag ? Visibility.Visible : Visibility.Collapsed;
        if (showMag)
        {
            int px = (int)_mousePx.X, py = (int)_mousePx.Y;
            ((ImageBrush)_magView.Fill).Viewbox = new Rect(px - 15, py - 10, 31, 21);
            var c = _shot.GetPixel(px, py);
            string hint = _sel == null
                ? (_longMode ? "框选要滚动的区域 · 单击选窗口" : "拖动框选 · 单击选窗口") + "\nC 复制颜色 · Esc 退出"
                : "";
            _magText.Text = $"{px}, {py}   #{c.R:X2}{c.G:X2}{c.B:X2}\nRGB({c.R}, {c.G}, {c.B})" + (hint.Length > 0 ? "\n" + hint : "");

            var m = _mousePx;
            double mx = (m.X + 1) * K + 18, my = (m.Y + 1) * K + 18;
            _magnifier.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
            var ms = _magnifier.DesiredSize;
            if (mx + ms.Width > W) mx = m.X * K - ms.Width - 12;
            if (my + ms.Height > H) my = m.Y * K - ms.Height - 12;
            Canvas.SetLeft(_magnifier, mx);
            Canvas.SetTop(_magnifier, my);
        }
    }
}
