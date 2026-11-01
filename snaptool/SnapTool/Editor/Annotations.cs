using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using SnapTool.Capture;

namespace SnapTool.Editor;

public enum Tool { Select, Rect, Ellipse, Arrow, Line, Pen, Highlighter, Text, Number, Mosaic, Blur }

/// <summary>挂在每个标注元素 Tag 上的信息。</summary>
public sealed class AnnotationInfo(Tool kind, Color color)
{
    public Tool Kind { get; } = kind;
    public Color Color { get; set; } = color;
    public int Number { get; init; }
}

public sealed class UndoStack
{
    readonly Stack<(Action Undo, Action Redo)> _undo = new(), _redo = new();

    public event Action? Changed;
    public bool CanUndo => _undo.Count > 0;
    public bool CanRedo => _redo.Count > 0;
    /// <summary>内容每变一次就加 1，用于判断导出缓存是否过期。</summary>
    public int Version { get; private set; }

    public void Push(Action undo, Action redo)
    {
        _undo.Push((undo, redo));
        _redo.Clear();
        Version++;
        Changed?.Invoke();
    }

    public void Undo()
    {
        if (!_undo.TryPop(out var c)) return;
        c.Undo();
        _redo.Push(c);
        Version++;
        Changed?.Invoke();
    }

    public void Redo()
    {
        if (!_redo.TryPop(out var c)) return;
        c.Redo();
        _undo.Push(c);
        Version++;
        Changed?.Invoke();
    }
}

public static class AnnotationFactory
{
    public static SolidColorBrush Brush(Color c) => UiKit.Freeze(new SolidColorBrush(c));

    public static bool IsLight(Color c) => c.R * 0.299 + c.G * 0.587 + c.B * 0.114 > 160;

    /// <summary>按标注类型设置颜色（新建和改色共用）。</summary>
    public static void ApplyColor(FrameworkElement el, Color c)
    {
        if (el.Tag is not AnnotationInfo info) return;
        info.Color = c;
        var brush = Brush(c);
        switch (el)
        {
            case Polyline pl when info.Kind == Tool.Highlighter:
                pl.Stroke = Brush(Color.FromArgb(0x66, c.R, c.G, c.B));
                break;
            case Path p:
                p.Stroke = brush;
                p.Fill = brush;
                break;
            case Shape s:
                s.Stroke = brush;
                break;
            case TextBlock tb:
                tb.Foreground = brush;
                break;
            case Grid g when info.Kind == Tool.Number:
                ((Ellipse)g.Children[0]).Fill = brush;
                ((TextBlock)g.Children[1]).Foreground = IsLight(c) ? Brushes.Black : Brushes.White;
                break;
        }
    }

    /// <summary>箭头：尾部细、头部为实心三角的单个闭合图形。</summary>
    public static Geometry Arrow(Point a, Point b, double t)
    {
        Vector v = b - a;
        double len = v.Length;
        if (len < 1) return Geometry.Empty;
        v /= len;
        var n = new Vector(-v.Y, v.X);
        double headLen = Math.Min(len, Math.Max(12, t * 4.2));
        double headW = Math.Max(10, t * 3.6);
        Point basePt = b - v * headLen;

        var fig = new PathFigure { StartPoint = a + n * (t * 0.2), IsClosed = true, IsFilled = true };
        fig.Segments.Add(new PolyLineSegment(
        [
            basePt + n * (t * 0.65),
            basePt + n * (headW / 2),
            b,
            basePt - n * (headW / 2),
            basePt - n * (t * 0.65),
            a - n * (t * 0.2),
        ], true));
        var g = new PathGeometry([fig]);
        g.Freeze();
        return g;
    }

    public static Grid NumberMarker(int number, double t)
    {
        double d = 20 + t * 3;
        var g = new Grid { Width = d, Height = d };
        g.Children.Add(new Ellipse { Stroke = Brushes.White, StrokeThickness = Math.Max(1.5, d / 14) });
        g.Children.Add(new TextBlock
        {
            Text = number.ToString(),
            FontSize = d * 0.55,
            FontWeight = FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
        });
        return g;
    }

    /// <summary>马赛克或模糊：从原图取像素生成一块图片盖在上面。</summary>
    public static Image Obscure(RawImage raw, Int32Rect r, Tool kind, double t)
    {
        var px = raw.Crop(r).Pixels;
        int w = r.Width, h = r.Height;
        if (kind == Tool.Mosaic) Pixelate(px, w, h, Math.Max(4, (int)(t * 2.5)));
        else
        {
            int radius = Math.Max(3, (int)(t * 2));
            for (int i = 0; i < 3; i++) BoxBlur(px, w, h, radius); // 三次盒式模糊 ≈ 高斯模糊
        }
        var bmp = BitmapSource.Create(w, h, 96, 96, PixelFormats.Bgra32, null, px, w * 4);
        bmp.Freeze();
        var img = new Image { Source = bmp, Width = w, Height = h, Stretch = Stretch.Fill };
        RenderOptions.SetBitmapScalingMode(img, kind == Tool.Mosaic ? BitmapScalingMode.NearestNeighbor : BitmapScalingMode.HighQuality);
        Canvas.SetLeft(img, r.X);
        Canvas.SetTop(img, r.Y);
        return img;
    }

    static void Pixelate(byte[] px, int w, int h, int block)
    {
        for (int by = 0; by < h; by += block)
        for (int bx = 0; bx < w; bx += block)
        {
            int x2 = Math.Min(bx + block, w), y2 = Math.Min(by + block, h);
            long b = 0, g = 0, r = 0, n = 0;
            for (int y = by; y < y2; y++)
            for (int x = bx; x < x2; x++)
            {
                int i = (y * w + x) * 4;
                b += px[i]; g += px[i + 1]; r += px[i + 2]; n++;
            }
            byte B = (byte)(b / n), G = (byte)(g / n), R = (byte)(r / n);
            for (int y = by; y < y2; y++)
            for (int x = bx; x < x2; x++)
            {
                int i = (y * w + x) * 4;
                px[i] = B; px[i + 1] = G; px[i + 2] = R; px[i + 3] = 255;
            }
        }
    }

    static void BoxBlur(byte[] px, int w, int h, int radius)
    {
        var tmp = new byte[px.Length];
        BlurPass(px, tmp, w, h, radius, horizontal: true);
        BlurPass(tmp, px, w, h, radius, horizontal: false);
    }

    static void BlurPass(byte[] src, byte[] dst, int w, int h, int r, bool horizontal)
    {
        int lines = horizontal ? h : w, len = horizontal ? w : h;
        int step = horizontal ? 4 : w * 4;
        for (int line = 0; line < lines; line++)
        {
            int start = horizontal ? line * w * 4 : line * 4;
            for (int c = 0; c < 4; c++)
            {
                int sum = 0;
                // 边缘用最近的像素补齐
                for (int k = -r; k <= r; k++) sum += src[start + Math.Clamp(k, 0, len - 1) * step + c];
                int win = r * 2 + 1;
                for (int i = 0; i < len; i++)
                {
                    dst[start + i * step + c] = (byte)(sum / win);
                    int add = Math.Min(i + r + 1, len - 1), rem = Math.Max(i - r, 0);
                    sum += src[start + add * step + c] - src[start + rem * step + c];
                }
            }
        }
    }
}
