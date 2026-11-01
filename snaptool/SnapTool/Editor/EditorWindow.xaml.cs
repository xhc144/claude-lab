using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;
using Microsoft.Win32;
using SnapTool.Capture;
using SnapTool.Export;
using static SnapTool.Editor.AnnotationFactory;
using Path = System.Windows.Shapes.Path;

namespace SnapTool.Editor;

public partial class EditorWindow : Window
{
    static readonly (Color Color, string Name)[] Palette =
    [
        (Color.FromRgb(0xE5, 0x39, 0x35), "红"),
        (Color.FromRgb(0xFB, 0x8C, 0x00), "橙"),
        (Color.FromRgb(0xFD, 0xD8, 0x35), "黄"),
        (Color.FromRgb(0x43, 0xA0, 0x47), "绿"),
        (Color.FromRgb(0x1E, 0x88, 0xE5), "蓝"),
        (Color.FromRgb(0x8E, 0x24, 0xAA), "紫"),
        (Color.FromRgb(0x21, 0x21, 0x21), "黑"),
        (Color.FromRgb(0xFF, 0xFF, 0xFF), "白"),
    ];

    // 记住上次用的颜色和粗细，下次打开编辑器沿用
    static Color s_color = Palette[0].Color;
    static double s_thickness = 4;
    static Tool s_tool = Tool.Rect;

    readonly BitmapSource _image;
    readonly string? _sourcePath;
    readonly int _w, _h;
    readonly UndoStack _undo = new();
    readonly DispatcherTimer _estimateTimer;
    readonly Rectangle _selBox = new()
    {
        Stroke = UiKit.AccentBrush,
        StrokeDashArray = [4, 3],
        Visibility = Visibility.Collapsed,
    };
    readonly List<Border> _swatches = [];
    RawImage? _raw;
    bool _ready;

    Tool _tool;
    Color _color;
    double Thickness => ThicknessSlider.Value;

    // 正在画的图形
    FrameworkElement? _drawing;
    Point _start;
    TextBox? _editingText;

    // 选择 / 移动
    FrameworkElement? _selected;
    bool _moving;
    Point _moveStart, _moveOrigin;

    double _zoom = 1;
    bool _syncingSize;

    // 导出缓存：设置和内容都没变时，保存直接用预览时算好的结果
    (ExportOptions Options, int Version, ExportResult Result)? _cache;

    public EditorWindow(BitmapSource image, string? sourcePath = null)
    {
        InitializeComponent();
        _image = image;
        _sourcePath = sourcePath;
        _w = image.PixelWidth;
        _h = image.PixelHeight;

        BaseImage.Source = image;
        foreach (var el in new FrameworkElement[] { BaseImage, Ink, Surface })
        {
            el.Width = _w;
            el.Height = _h;
        }
        Overlay.Children.Add(_selBox);

        Title = sourcePath != null
            ? $"{System.IO.Path.GetFileName(sourcePath)} - SnapTool"
            : $"截图 {_w} × {_h} - SnapTool";

        BuildPalette();
        SetColor(s_color, recolorSelection: false);
        ThicknessSlider.Value = s_thickness;
        ThicknessSlider.ValueChanged += (_, _) => s_thickness = Thickness;

        _syncingSize = true;
        WidthBox.Text = _w.ToString();
        HeightBox.Text = _h.ToString();
        _syncingSize = false;

        _estimateTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(450) };
        _estimateTimer.Tick += (_, _) =>
        {
            _estimateTimer.Stop();
            UpdateEstimate();
        };

        _undo.Changed += () =>
        {
            UndoButton.IsEnabled = _undo.CanUndo;
            RedoButton.IsEnabled = _undo.CanRedo;
            if (_selected != null && !Ink.Children.Contains(_selected)) Select(null);
            UpdateSelBox();
            UpdateStatus();
            ScheduleEstimate();
        };
        UndoButton.IsEnabled = RedoButton.IsEnabled = DeleteButton.IsEnabled = false;

        _ready = true;
        this.FitToWorkArea();
        CheckTool(s_tool);
        UpdateStatus();
        Loaded += (_, _) =>
        {
            ZoomFit();
            UpdateEstimate();
            Activate();
        };
    }

    // ======================= 工具与颜色 =======================

    void BuildPalette()
    {
        foreach (var (color, name) in Palette)
        {
            var sw = new Border
            {
                Width = 20,
                Height = 20,
                CornerRadius = new CornerRadius(10),
                Margin = new Thickness(2, 0, 2, 0),
                Background = Brush(color),
                Cursor = Cursors.Hand,
                ToolTip = name,
                Tag = color,
            };
            sw.MouseLeftButtonUp += (_, _) => SetColor(color, recolorSelection: true);
            _swatches.Add(sw);
            ColorPanel.Children.Add(sw);
        }
    }

    void SetColor(Color c, bool recolorSelection)
    {
        _color = c;
        s_color = c;
        foreach (var sw in _swatches)
        {
            bool on = (Color)sw.Tag == c;
            // 选中的颜色加白色外圈并稍微放大
            sw.BorderBrush = on ? Brushes.White : Brush(Color.FromArgb(0x50, 0xFF, 0xFF, 0xFF));
            sw.BorderThickness = new Thickness(on ? 2.5 : 1);
            sw.RenderTransformOrigin = new Point(0.5, 0.5);
            sw.RenderTransform = on ? new ScaleTransform(1.15, 1.15) : null;
        }

        // 选中某个标注时点颜色 = 给它换颜色
        if (recolorSelection && _selected is { Tag: AnnotationInfo info } el && info.Kind is not (Tool.Mosaic or Tool.Blur))
        {
            var old = info.Color;
            if (old == c) return;
            ApplyColor(el, c);
            _undo.Push(() => ApplyColor(el, old), () => ApplyColor(el, c));
        }
    }

    void CheckTool(Tool t)
    {
        foreach (var rb in FindToolButtons())
            if ((string)rb.Tag == t.ToString()) rb.IsChecked = true;
    }

    IEnumerable<RadioButton> FindToolButtons() =>
        ((Panel)SelectTool.Parent).Children.OfType<RadioButton>();

    void Tool_Checked(object sender, RoutedEventArgs e)
    {
        if (!_ready) return;
        CommitText();
        _tool = Enum.Parse<Tool>((string)((RadioButton)sender).Tag);
        s_tool = _tool;
        if (_tool != Tool.Select) Select(null);
        Ink.Cursor = _tool switch
        {
            Tool.Select => Cursors.Arrow,
            Tool.Text => Cursors.IBeam,
            Tool.Number => Cursors.Hand,
            _ => Cursors.Cross,
        };
    }

    // ======================= 画布鼠标 =======================

    void Ink_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        e.Handled = true;
        if (_editingText != null)
        {
            CommitText();
            return;
        }

        var p = e.GetPosition(Ink);
        switch (_tool)
        {
            case Tool.Select:
                var hit = HitAnnotation(e.OriginalSource as DependencyObject);
                Select(hit);
                if (hit != null)
                {
                    var tt = (TranslateTransform)hit.RenderTransform;
                    _moving = true;
                    _moveStart = p;
                    _moveOrigin = new Point(tt.X, tt.Y);
                    Ink.CaptureMouse();
                }
                break;
            case Tool.Text:
                BeginText(p);
                break;
            case Tool.Number:
                AddNumber(p);
                break;
            default:
                BeginShape(p);
                Ink.CaptureMouse();
                break;
        }
    }

    void Ink_MouseMove(object sender, MouseEventArgs e)
    {
        var p = e.GetPosition(Ink);
        if (_moving && _selected != null)
        {
            var tt = (TranslateTransform)_selected.RenderTransform;
            tt.X = _moveOrigin.X + p.X - _moveStart.X;
            tt.Y = _moveOrigin.Y + p.Y - _moveStart.Y;
            UpdateSelBox();
        }
        else if (_drawing != null)
        {
            UpdateShape(p, Keyboard.Modifiers.HasFlag(ModifierKeys.Shift));
        }
    }

    void Ink_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        Ink.ReleaseMouseCapture();
        if (_moving && _selected != null)
        {
            _moving = false;
            var el = _selected;
            var tt = (TranslateTransform)el.RenderTransform;
            var from = _moveOrigin;
            var to = new Point(tt.X, tt.Y);
            if (from != to)
                _undo.Push(() => SetOffset(el, from), () => SetOffset(el, to));
            return;
        }
        _moving = false;
        if (_drawing != null) FinishShape(e.GetPosition(Ink));
    }

    static void SetOffset(UIElement el, Point p)
    {
        var tt = (TranslateTransform)el.RenderTransform;
        tt.X = p.X;
        tt.Y = p.Y;
    }

    FrameworkElement? HitAnnotation(DependencyObject? d)
    {
        while (d != null && d != Ink)
        {
            var parent = VisualTreeHelper.GetParent(d);
            if (parent == Ink) return d as FrameworkElement;
            d = parent;
        }
        return null;
    }

    void Prepare(FrameworkElement el, Tool kind)
    {
        el.Tag = new AnnotationInfo(kind, _color);
        el.RenderTransform = new TranslateTransform();
        ApplyColor(el, _color);
    }

    void AddWithUndo(FrameworkElement el)
    {
        if (!Ink.Children.Contains(el)) Ink.Children.Add(el);
        _undo.Push(() => Ink.Children.Remove(el), () => Ink.Children.Add(el));
    }

    // ---------- 图形 ----------

    void BeginShape(Point p)
    {
        double t = Thickness;
        FrameworkElement el = _tool switch
        {
            Tool.Rect => new Rectangle { StrokeThickness = t, StrokeLineJoin = PenLineJoin.Round },
            Tool.Ellipse => new Ellipse { StrokeThickness = t },
            Tool.Line => new Line
            {
                X1 = p.X, Y1 = p.Y, X2 = p.X, Y2 = p.Y,
                StrokeThickness = t,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
            },
            Tool.Arrow => new Path { StrokeThickness = 1, StrokeLineJoin = PenLineJoin.Round },
            Tool.Pen => new Polyline
            {
                Points = [p],
                StrokeThickness = t,
                StrokeLineJoin = PenLineJoin.Round,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
            },
            Tool.Highlighter => new Polyline
            {
                Points = [p],
                StrokeThickness = t * 3 + 8,
                StrokeLineJoin = PenLineJoin.Round,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
            },
            // 马赛克 / 模糊先画一个虚线框，松开鼠标再生成
            _ => new Rectangle
            {
                Stroke = Brushes.Gray,
                StrokeThickness = 1.5 / _zoom,
                StrokeDashArray = [4, 3],
                Fill = Brush(Color.FromArgb(0x30, 0x80, 0x80, 0x80)),
            },
        };
        if (_tool is Tool.Mosaic or Tool.Blur)
        {
            el.Tag = new AnnotationInfo(_tool, _color);
            el.RenderTransform = new TranslateTransform();
        }
        else Prepare(el, _tool);

        if (el is Rectangle or Ellipse)
        {
            Canvas.SetLeft(el, p.X);
            Canvas.SetTop(el, p.Y);
            el.Width = el.Height = 0;
        }
        Ink.Children.Add(el);
        _drawing = el;
        _start = p;
    }

    void UpdateShape(Point p, bool shift)
    {
        switch (_drawing)
        {
            case Rectangle or Ellipse:
                var kind = ((AnnotationInfo)_drawing.Tag).Kind;
                var r = RectFrom(_start, p, shift && kind is Tool.Rect or Tool.Ellipse);
                Canvas.SetLeft(_drawing, r.X);
                Canvas.SetTop(_drawing, r.Y);
                _drawing.Width = r.Width;
                _drawing.Height = r.Height;
                break;
            case Line line:
                var e = shift ? Snap45(_start, p) : p;
                line.X2 = e.X;
                line.Y2 = e.Y;
                break;
            case Path path:
                path.Data = Arrow(_start, shift ? Snap45(_start, p) : p, Thickness);
                break;
            case Polyline pl:
                if ((pl.Points[^1] - p).Length >= 1) pl.Points.Add(p);
                break;
        }
    }

    void FinishShape(Point p)
    {
        var el = _drawing!;
        _drawing = null;
        var kind = ((AnnotationInfo)el.Tag).Kind;

        switch (el)
        {
            case Polyline pl when pl.Points.Count == 1:
                pl.Points.Add(pl.Points[0] + new Vector(0.1, 0.1)); // 单击画一个点
                break;
            case Line l when Math.Abs(l.X2 - l.X1) + Math.Abs(l.Y2 - l.Y1) < 3:
            case Path pa when (pa.Data?.Bounds.IsEmpty ?? true):
            case Rectangle or Ellipse when el.Width < 2 && el.Height < 2:
                Ink.Children.Remove(el);
                return;
        }

        if (kind is Tool.Mosaic or Tool.Blur)
        {
            Ink.Children.Remove(el);
            var area = new Rect(Canvas.GetLeft(el), Canvas.GetTop(el), el.Width, el.Height);
            area.Intersect(new Rect(0, 0, _w, _h));
            if (area.IsEmpty || area.Width < 2 || area.Height < 2) return;
            var ir = new Int32Rect((int)area.X, (int)area.Y, (int)Math.Ceiling(area.Width), (int)Math.Ceiling(area.Height));
            ir.Width = Math.Min(ir.Width, _w - ir.X);
            ir.Height = Math.Min(ir.Height, _h - ir.Y);
            _raw ??= RawImage.FromBitmapSource(_image);
            var img = Obscure(_raw, ir, kind, Thickness);
            img.Tag = new AnnotationInfo(kind, _color);
            img.RenderTransform = new TranslateTransform();
            el = img;
        }
        AddWithUndo(el);
    }

    static Rect RectFrom(Point a, Point b, bool square)
    {
        double dx = b.X - a.X, dy = b.Y - a.Y;
        if (square)
        {
            double s = Math.Max(Math.Abs(dx), Math.Abs(dy));
            dx = Math.Sign(dx == 0 ? 1 : dx) * s;
            dy = Math.Sign(dy == 0 ? 1 : dy) * s;
        }
        return new Rect(a, new Point(a.X + dx, a.Y + dy));
    }

    static Point Snap45(Point a, Point b)
    {
        Vector v = b - a;
        double angle = Math.Round(Math.Atan2(v.Y, v.X) / (Math.PI / 4)) * (Math.PI / 4);
        return a + new Vector(Math.Cos(angle), Math.Sin(angle)) * v.Length;
    }

    // ---------- 序号 ----------

    void AddNumber(Point p)
    {
        int next = Ink.Children.OfType<FrameworkElement>()
            .Select(el => el.Tag is AnnotationInfo { Kind: Tool.Number } i ? i.Number : 0)
            .DefaultIfEmpty(0).Max() + 1;
        var g = NumberMarker(next, Thickness);
        g.Tag = new AnnotationInfo(Tool.Number, _color) { Number = next };
        g.RenderTransform = new TranslateTransform();
        ApplyColor(g, _color);
        Canvas.SetLeft(g, p.X - g.Width / 2);
        Canvas.SetTop(g, p.Y - g.Height / 2);
        AddWithUndo(g);
    }

    // ---------- 文字 ----------

    double TextSize => 12 + Thickness * 2.5;

    void BeginText(Point p)
    {
        var tb = new TextBox
        {
            Style = new Style(typeof(TextBox)), // 不用 Fluent 输入框样式，保持透明
            MinWidth = 80,
            FontSize = TextSize,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brush(_color),
            CaretBrush = Brush(_color),
            Background = Brushes.Transparent,
            BorderBrush = UiKit.AccentBrush,
            BorderThickness = new Thickness(1),
            Padding = new Thickness(2),
            AcceptsReturn = true,
        };
        Canvas.SetLeft(tb, p.X);
        Canvas.SetTop(tb, p.Y - TextSize * 0.75);
        Ink.Children.Add(tb);
        _editingText = tb;
        tb.LostKeyboardFocus += (_, _) => CommitText();
        Dispatcher.BeginInvoke(() =>
        {
            tb.Focus();
            Keyboard.Focus(tb);
        }, DispatcherPriority.Input);
    }

    void CommitText()
    {
        var tb = _editingText;
        if (tb == null) return;
        _editingText = null;
        Ink.Children.Remove(tb);
        if (string.IsNullOrWhiteSpace(tb.Text)) return;

        var block = new TextBlock
        {
            Text = tb.Text,
            FontSize = tb.FontSize,
            FontWeight = FontWeights.SemiBold,
            Background = Brushes.Transparent,
            Padding = new Thickness(5, 3, 5, 3),
        };
        block.Tag = new AnnotationInfo(Tool.Text, ((SolidColorBrush)tb.Foreground).Color);
        block.RenderTransform = new TranslateTransform();
        ApplyColor(block, ((AnnotationInfo)block.Tag).Color);
        Canvas.SetLeft(block, Canvas.GetLeft(tb));
        Canvas.SetTop(block, Canvas.GetTop(tb));
        AddWithUndo(block);
    }

    // ---------- 选择 ----------

    void Select(FrameworkElement? el)
    {
        _selected = el;
        DeleteButton.IsEnabled = el != null;
        UpdateSelBox();
    }

    void UpdateSelBox()
    {
        if (_selected == null || !Ink.Children.Contains(_selected))
        {
            _selBox.Visibility = Visibility.Collapsed;
            return;
        }
        Ink.UpdateLayout();
        var b = VisualTreeHelper.GetDescendantBounds(_selected);
        if (b.IsEmpty) b = new Rect(_selected.RenderSize);
        b = _selected.TransformToVisual(Ink).TransformBounds(b);
        b.Inflate(4 / _zoom, 4 / _zoom);
        _selBox.StrokeThickness = 1.5 / _zoom;
        _selBox.Width = b.Width;
        _selBox.Height = b.Height;
        Canvas.SetLeft(_selBox, b.X);
        Canvas.SetTop(_selBox, b.Y);
        _selBox.Visibility = Visibility.Visible;
    }

    void DeleteSelected()
    {
        if (_selected is not { } el) return;
        int index = Ink.Children.IndexOf(el);
        Ink.Children.Remove(el);
        _undo.Push(() => Ink.Children.Insert(Math.Min(index, Ink.Children.Count), el), () => Ink.Children.Remove(el));
    }

    // ======================= 工具栏按钮 =======================

    void Undo_Click(object sender, RoutedEventArgs e) { CommitText(); _undo.Undo(); }
    void Redo_Click(object sender, RoutedEventArgs e) { CommitText(); _undo.Redo(); }
    void Delete_Click(object sender, RoutedEventArgs e) => DeleteSelected();

    void ClearAll_Click(object sender, RoutedEventArgs e)
    {
        CommitText();
        var items = Ink.Children.Cast<UIElement>().ToList();
        if (items.Count == 0) return;
        Ink.Children.Clear();
        _undo.Push(() => items.ForEach(i => Ink.Children.Add(i)), () => Ink.Children.Clear());
    }

    void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        bool ctrl = Keyboard.Modifiers.HasFlag(ModifierKeys.Control);
        bool shift = Keyboard.Modifiers.HasFlag(ModifierKeys.Shift);

        if (_editingText != null)
        {
            if (e.Key == Key.Escape || (e.Key == Key.Enter && ctrl))
            {
                CommitText();
                e.Handled = true;
            }
            return;
        }
        // 正在输入尺寸等数值时，不拦截按键
        if (Keyboard.FocusedElement is TextBox) return;

        if (ctrl)
        {
            switch (e.Key)
            {
                case Key.Z when shift: _undo.Redo(); break;
                case Key.Z: _undo.Undo(); break;
                case Key.Y: _undo.Redo(); break;
                case Key.C: Copy_Click(this, e); break;
                case Key.S when shift: SaveAs_Click(this, e); break;
                case Key.S: QuickSave_Click(this, e); break;
                case Key.OemPlus or Key.Add: SetZoom(_zoom * 1.25); break;
                case Key.OemMinus or Key.Subtract: SetZoom(_zoom / 1.25); break;
                case Key.D0 or Key.NumPad0: ZoomFit(); break;
                default: return;
            }
            e.Handled = true;
            return;
        }

        Tool? tool = e.Key switch
        {
            Key.V => Tool.Select,
            Key.R => Tool.Rect,
            Key.E => Tool.Ellipse,
            Key.A => Tool.Arrow,
            Key.L => Tool.Line,
            Key.P => Tool.Pen,
            Key.H => Tool.Highlighter,
            Key.T => Tool.Text,
            Key.N => Tool.Number,
            Key.M => Tool.Mosaic,
            Key.B => Tool.Blur,
            _ => null,
        };
        if (tool is { } t)
        {
            CheckTool(t);
            e.Handled = true;
        }
        else if (e.Key == Key.Delete || e.Key == Key.Back)
        {
            DeleteSelected();
            e.Handled = true;
        }
        else if (e.Key == Key.Escape)
        {
            Select(null);
            e.Handled = true;
        }
    }

    // ======================= 缩放视图 =======================

    void SetZoom(double z)
    {
        _zoom = Math.Clamp(z, 0.02, 16);
        Zoom.ScaleX = Zoom.ScaleY = _zoom;
        ZoomText.Text = $"{_zoom * 100:0}%";
        // 缩小看时用高质量，放大看时显示清晰的像素格
        RenderOptions.SetBitmapScalingMode(BaseImage, _zoom >= 1 ? BitmapScalingMode.NearestNeighbor : BitmapScalingMode.HighQuality);
        UpdateSelBox();
    }

    void ZoomFit()
    {
        double aw = Scroller.ActualWidth - 68, ah = Scroller.ActualHeight - 52; // 留出边距和滚动条
        if (aw <= 0 || ah <= 0) return;
        double z = Math.Min(aw / _w, ah / _h);
        if (_h > _w * 2.5) z = aw / _w; // 长图按宽度适应，上下滚动查看
        SetZoom(Math.Min(1, z));
    }

    void Scroller_PreviewMouseWheel(object sender, MouseWheelEventArgs e)
    {
        if (!Keyboard.Modifiers.HasFlag(ModifierKeys.Control)) return;
        e.Handled = true;
        var content = e.GetPosition(Surface);
        var viewer = e.GetPosition(Scroller);
        SetZoom(_zoom * (e.Delta > 0 ? 1.15 : 1 / 1.15));
        Scroller.UpdateLayout();
        // 以鼠标位置为中心缩放
        var now = Surface.TranslatePoint(content, Scroller);
        Scroller.ScrollToHorizontalOffset(Scroller.HorizontalOffset + now.X - viewer.X);
        Scroller.ScrollToVerticalOffset(Scroller.VerticalOffset + now.Y - viewer.Y);
    }

    void ZoomIn_Click(object sender, RoutedEventArgs e) => SetZoom(_zoom * 1.25);
    void ZoomOut_Click(object sender, RoutedEventArgs e) => SetZoom(_zoom / 1.25);
    void ZoomFit_Click(object sender, RoutedEventArgs e) => ZoomFit();
    void Zoom100_Click(object sender, RoutedEventArgs e) => SetZoom(1);

    // ======================= 尺寸面板 =======================

    void SetSize(int w, int h)
    {
        _syncingSize = true;
        WidthBox.Text = w.ToString();
        HeightBox.Text = h.ToString();
        _syncingSize = false;
        ScheduleEstimate();
    }

    void WidthBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (!_ready || _syncingSize) return;
        if (LockRatio.IsChecked == true && int.TryParse(WidthBox.Text, out int w) && w > 0)
        {
            _syncingSize = true;
            HeightBox.Text = Math.Max(1, (int)Math.Round(w * (double)_h / _w)).ToString();
            _syncingSize = false;
        }
        ScheduleEstimate();
    }

    void HeightBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (!_ready || _syncingSize) return;
        if (LockRatio.IsChecked == true && int.TryParse(HeightBox.Text, out int h) && h > 0)
        {
            _syncingSize = true;
            WidthBox.Text = Math.Max(1, (int)Math.Round(h * (double)_w / _h)).ToString();
            _syncingSize = false;
        }
        ScheduleEstimate();
    }

    void LockRatio_Click(object sender, RoutedEventArgs e)
    {
        if (LockRatio.IsChecked == true && int.TryParse(WidthBox.Text, out int w) && w > 0)
            SetSize(w, Math.Max(1, (int)Math.Round(w * (double)_h / _w)));
    }

    void Scale_Click(object sender, RoutedEventArgs e)
    {
        var tag = (string)((Button)sender).Tag;
        if (tag.StartsWith('w'))
        {
            int tw = int.Parse(tag[1..], CultureInfo.InvariantCulture);
            SetSize(tw, Math.Max(1, (int)Math.Round((double)tw * _h / _w)));
            return;
        }
        double p = double.Parse(tag, CultureInfo.InvariantCulture) / 100;
        SetSize(Math.Max(1, (int)Math.Round(_w * p)), Math.Max(1, (int)Math.Round(_h * p)));
    }

    void ResetSize_Click(object sender, RoutedEventArgs e) => SetSize(_w, _h);

    void Format_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (!_ready) return;
        var fmt = SelectedFormat;
        QualityPanel.Visibility = ImageExport.IsLossy(fmt) ? Visibility.Visible : Visibility.Collapsed;
        PdfPanel.Visibility = fmt == ExportFormat.Pdf ? Visibility.Visible : Visibility.Collapsed;
        ScheduleEstimate();
    }

    void Option_Changed(object sender, RoutedEventArgs e) => ScheduleEstimate();

    ExportFormat SelectedFormat => FormatBox.SelectedIndex switch
    {
        1 => ExportFormat.Jpg,
        2 => ExportFormat.Pdf,
        3 => ExportFormat.Bmp,
        4 => ExportFormat.Tiff,
        _ => ExportFormat.Png,
    };

    static string FormatName(ExportFormat f) => f.ToString().ToUpperInvariant();

    ExportOptions? ReadOptions(out string error)
    {
        error = "";
        if (!int.TryParse(WidthBox.Text, out int w) || !int.TryParse(HeightBox.Text, out int h) ||
            w < 1 || h < 1 || w > 60000 || h > 60000)
        {
            error = "宽和高需要是 1 到 60000 之间的整数。";
            return null;
        }
        if ((long)w * h > 400_000_000)
        {
            error = "尺寸太大了（超过 4 亿像素），请缩小一些。";
            return null;
        }
        if (!double.TryParse(DpiBox.Text, NumberStyles.Float, CultureInfo.InvariantCulture, out double dpi) || dpi < 10 || dpi > 2400)
        {
            error = "DPI 需要是 10 到 2400 之间的数字。";
            return null;
        }
        long? max = null;
        if (LimitSize.IsChecked == true)
        {
            if (!double.TryParse(LimitBox.Text, NumberStyles.Float, CultureInfo.InvariantCulture, out double v) || v <= 0)
            {
                error = "请填写有效的文件大小上限。";
                return null;
            }
            max = (long)(v * (LimitUnit.SelectedIndex == 1 ? 1024 * 1024 : 1024));
        }
        var scaling = AlgoBox.SelectedIndex switch
        {
            1 => BitmapScalingMode.Linear,
            2 => BitmapScalingMode.NearestNeighbor,
            _ => BitmapScalingMode.HighQuality,
        };
        var pdf = PdfPageBox.SelectedIndex switch
        {
            0 => PdfPageMode.Original,
            2 => PdfPageMode.A4Landscape,
            3 => PdfPageMode.LetterPortrait,
            _ => PdfPageMode.A4Portrait,
        };
        return new ExportOptions(w, h, scaling, dpi, SelectedFormat, (int)QualitySlider.Value, max, pdf);
    }

    void ScheduleEstimate()
    {
        if (!_ready) return;
        _cache = null;
        EstimateText.Text = "计算中…";
        _estimateTimer.Stop();
        _estimateTimer.Start();
    }

    void UpdateEstimate()
    {
        var o = ReadOptions(out var error);
        if (o == null)
        {
            EstimateText.Text = error;
            PrintSizeText.Text = "";
            return;
        }
        PrintSizeText.Text = $"按 {o.Dpi:0.#} DPI 打印约 {o.Width / o.Dpi * 2.54:0.#} × {o.Height / o.Dpi * 2.54:0.#} cm";
        try
        {
            var r = RunExport(o);
            var text = $"{r.Width} × {r.Height} px · {FormatName(o.Format)} · {ImageExport.FormatSize(r.Data.Length)}";
            if (o.Format == ExportFormat.Pdf) text += $" · 共 {r.Pages} 页";
            if (o.MaxBytes != null)
            {
                if (!r.LimitMet) text += "\n⚠ 已经尽量压缩，仍然超过限制。";
                else
                {
                    if (r.Width != o.Width) text += $"\n为满足大小限制，尺寸自动缩小到 {r.Width} × {r.Height}。";
                    if (ImageExport.IsLossy(o.Format) && r.Quality != o.Quality) text += $"\n质量自动调整为 {r.Quality}。";
                }
            }
            EstimateText.Text = text;
        }
        catch (Exception ex)
        {
            EstimateText.Text = "无法计算：" + ex.Message;
        }
    }

    ExportResult RunExport(ExportOptions o)
    {
        CommitText();
        if (_cache is { } c && c.Options == o && c.Version == _undo.Version) return c.Result;
        var result = ImageExport.Export((w, h) => Render(w, h, o.Scaling), o);
        _cache = (o, _undo.Version, result);
        return result;
    }

    /// <summary>把原图和全部标注合成为 w×h 像素的位图。标注是矢量，放大导出也清晰。</summary>
    internal BitmapSource Render(int w, int h, BitmapScalingMode mode)
    {
        if (Ink.Children.Count == 0 && w == _w && h == _h) return _image;

        var old = RenderOptions.GetBitmapScalingMode(BaseImage);
        RenderOptions.SetBitmapScalingMode(BaseImage, mode);
        try
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                var brush = new VisualBrush(Surface)
                {
                    Viewbox = new Rect(0, 0, _w, _h),
                    ViewboxUnits = BrushMappingMode.Absolute,
                    Stretch = Stretch.Fill,
                };
                dc.DrawRectangle(brush, null, new Rect(0, 0, w, h));
            }
            var rtb = new RenderTargetBitmap(w, h, 96, 96, PixelFormats.Pbgra32);
            rtb.Render(dv);
            rtb.Freeze();
            return rtb;
        }
        finally
        {
            RenderOptions.SetBitmapScalingMode(BaseImage, old);
        }
    }

    BitmapSource? RenderCurrentSize()
    {
        var o = ReadOptions(out var error);
        if (o == null)
        {
            MessageBox.Show(this, error, "SnapTool");
            return null;
        }
        CommitText();
        return Render(o.Width, o.Height, o.Scaling);
    }

    // ======================= 输出 =======================

    void Copy_Click(object sender, RoutedEventArgs e)
    {
        if (RenderCurrentSize() is not { } bmp) return;
        ImageActions.CopyToClipboard(bmp);
        StatusText.Text = $"已复制到剪贴板（{bmp.PixelWidth} × {bmp.PixelHeight}）";
    }

    void Pin_Click(object sender, RoutedEventArgs e)
    {
        if (RenderCurrentSize() is not { } bmp) return;
        new PinWindow(bmp).Show();
    }

    void QuickSave_Click(object sender, RoutedEventArgs e)
    {
        var o = ReadOptions(out var error);
        if (o == null)
        {
            MessageBox.Show(this, error, "SnapTool");
            return;
        }
        Directory.CreateDirectory(App.Settings.SaveFolder);
        var baseName = _sourcePath != null
            ? System.IO.Path.GetFileNameWithoutExtension(_sourcePath) + "_edited"
            : $"SnapTool_{DateTime.Now:yyyyMMdd_HHmmss}";
        var path = ImageActions.UniquePath(App.Settings.SaveFolder, baseName, ImageExport.Extension(o.Format));
        Save(path, o);
    }

    void SaveAs_Click(object sender, RoutedEventArgs e)
    {
        var o = ReadOptions(out var error);
        if (o == null)
        {
            MessageBox.Show(this, error, "SnapTool");
            return;
        }
        var formats = new[] { ExportFormat.Png, ExportFormat.Jpg, ExportFormat.Pdf, ExportFormat.Bmp, ExportFormat.Tiff };
        var dlg = new SaveFileDialog
        {
            Title = "另存为",
            Filter = "PNG 图片|*.png|JPG 图片|*.jpg;*.jpeg|PDF 文档|*.pdf|BMP 图片|*.bmp|TIFF 图片|*.tif;*.tiff",
            FilterIndex = Array.IndexOf(formats, o.Format) + 1,
            FileName = _sourcePath != null
                ? System.IO.Path.GetFileNameWithoutExtension(_sourcePath) + "_edited"
                : $"SnapTool_{DateTime.Now:yyyyMMdd_HHmmss}",
            InitialDirectory = Directory.Exists(App.Settings.SaveFolder) ? App.Settings.SaveFolder : "",
            AddExtension = true,
            DefaultExt = ImageExport.Extension(o.Format),
        };
        if (dlg.ShowDialog(this) != true) return;

        // 以用户选的扩展名为准
        var ext = System.IO.Path.GetExtension(dlg.FileName).ToLowerInvariant();
        var fmt = ext switch
        {
            ".jpg" or ".jpeg" => ExportFormat.Jpg,
            ".pdf" => ExportFormat.Pdf,
            ".bmp" => ExportFormat.Bmp,
            ".tif" or ".tiff" => ExportFormat.Tiff,
            ".png" => ExportFormat.Png,
            _ => formats[Math.Clamp(dlg.FilterIndex - 1, 0, formats.Length - 1)],
        };
        Save(dlg.FileName, o with { Format = fmt });
    }

    void Save(string path, ExportOptions o)
    {
        try
        {
            Cursor = Cursors.Wait;
            var r = RunExport(o);
            File.WriteAllBytes(path, r.Data);
            StatusText.Text = $"已保存：{path}（{ImageExport.FormatSize(r.Data.Length)}）";
            App.Current.Tray.Notify($"已保存 {System.IO.Path.GetFileName(path)}\n点击这里打开所在文件夹", path);
            if (o.MaxBytes != null && !r.LimitMet)
                MessageBox.Show(this, "已经尽量压缩，但文件仍然超过设定的大小上限。", "SnapTool");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"保存失败：{ex.Message}", "SnapTool");
        }
        finally
        {
            Cursor = null;
        }
    }

    void UpdateStatus()
    {
        int n = Ink.Children.Count;
        StatusText.Text = $"原图 {_w} × {_h} px" + (n > 0 ? $" · {n} 个标注" : "") +
                          (_sourcePath != null ? $" · {_sourcePath}" : "");
    }
}
