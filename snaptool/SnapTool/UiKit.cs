using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;

namespace SnapTool;

/// <summary>截图浮层上使用的深色小控件（这些窗口不走 Fluent 主题，避免背景材质干扰截图）。</summary>
public static class UiKit
{
    public static readonly FontFamily IconFont = new("Segoe Fluent Icons, Segoe MDL2 Assets");
    public static readonly Color Accent = Color.FromRgb(0x3B, 0x82, 0xF6);
    public static readonly Brush AccentBrush = Freeze(new SolidColorBrush(Accent));

    public static T Freeze<T>(T f) where T : Freezable
    {
        f.Freeze();
        return f;
    }

    /// <summary>深色圆角浮动面板（带阴影；放在透明窗口里时外面要留 12 左右的边距给阴影）。</summary>
    public static Border Panel(UIElement child) => new()
    {
        Background = Freeze(new SolidColorBrush(Color.FromArgb(0xF2, 0x1C, 0x1C, 0x21))),
        BorderBrush = Freeze(new SolidColorBrush(Color.FromArgb(0x33, 0xFF, 0xFF, 0xFF))),
        BorderThickness = new Thickness(1),
        CornerRadius = new CornerRadius(12),
        Padding = new Thickness(5),
        Child = child,
        SnapsToDevicePixels = true,
        Effect = new System.Windows.Media.Effects.DropShadowEffect { BlurRadius = 18, ShadowDepth = 3, Opacity = 0.45, Color = Colors.Black },
    };

    public static UIElement Divider() => new System.Windows.Shapes.Rectangle
    {
        Width = 1,
        Height = 20,
        Margin = new Thickness(5, 0, 5, 0),
        Fill = Freeze(new SolidColorBrush(Color.FromArgb(0x33, 0xFF, 0xFF, 0xFF))),
        VerticalAlignment = VerticalAlignment.Center,
    };

    public static Border Chip(string glyph, string text, Action onClick, bool accent = false, string? tooltip = null)
    {
        var normal = accent ? AccentBrush : Brushes.Transparent;
        var hover = accent
            ? Freeze(new SolidColorBrush(Color.FromRgb(0x60, 0x9A, 0xF8)))
            : Freeze(new SolidColorBrush(Color.FromArgb(0x24, 0xFF, 0xFF, 0xFF)));
        bool iconOnly = text.Length == 0;

        var row = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
        if (glyph.Length > 0)
            row.Children.Add(new TextBlock
            {
                Text = glyph,
                FontFamily = IconFont,
                FontSize = iconOnly ? 17 : 15,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, text.Length > 0 ? 6 : 0, 0),
            });
        if (text.Length > 0)
            row.Children.Add(new TextBlock { Text = text, FontSize = 13, VerticalAlignment = VerticalAlignment.Center });

        var chip = new Border
        {
            Background = normal,
            CornerRadius = new CornerRadius(8),
            Padding = iconOnly ? new Thickness(0) : new Thickness(12, 7, 12, 7),
            Width = iconOnly ? 38 : double.NaN,
            Height = 38,
            Margin = new Thickness(1),
            Cursor = Cursors.Hand,
            Child = row,
            ToolTip = tooltip,
        };
        TextElement.SetForeground(chip, Brushes.White);
        chip.MouseEnter += (_, _) => chip.Background = hover;
        chip.MouseLeave += (_, _) => chip.Background = normal;
        chip.MouseLeftButtonDown += (_, e) => e.Handled = true;
        chip.MouseLeftButtonUp += (_, e) =>
        {
            e.Handled = true;
            onClick();
        };
        return chip;
    }

    public static IntPtr Handle(this Window w) => new WindowInteropHelper(w).Handle;

    /// <summary>
    /// 让窗口不超出鼠标所在屏幕的可用区域（不压到任务栏下面），并在该区域居中。
    /// 高分屏（比如 200% 缩放）上固定尺寸的窗口很容易比屏幕还大：能最大化的窗口直接最大化打开，
    /// 其他窗口缩小到能放下。注意不能设 MaxWidth/MaxHeight，否则最大化时也会被限制住、铺不满屏幕。
    /// </summary>
    public static void FitToWorkArea(this Window w)
    {
        w.WindowStartupLocation = WindowStartupLocation.Manual;
        Native.GetCursorPos(out var p);
        var work = Native.WorkAreaAt(p.X, p.Y);

        w.SourceInitialized += (_, _) =>
        {
            double scale = VisualTreeHelper.GetDpi(w).DpiScaleX;
            double availW = work.Width / scale - 16, availH = (work.Bottom - work.Top) / scale - 16;
            w.MinWidth = Math.Min(w.MinWidth, availW);
            w.MinHeight = Math.Min(w.MinHeight, availH);
            bool tooBig = (!double.IsNaN(w.Width) && w.Width > availW) || (!double.IsNaN(w.Height) && w.Height > availH);
            if (!double.IsNaN(w.Width)) w.Width = Math.Min(w.Width, availW);
            if (!double.IsNaN(w.Height)) w.Height = Math.Min(w.Height, availH);
            if (w.SizeToContent != SizeToContent.Manual)
                w.MaxHeight = availH; // 随内容变高的窗口（设置）不能最大化，限制高度、内容自己滚动
            else if (tooBig && w.ResizeMode is ResizeMode.CanResize or ResizeMode.CanResizeWithGrip)
                w.WindowState = WindowState.Maximized;
        };
        w.Loaded += (_, _) =>
        {
            if (w.WindowState != WindowState.Normal) return;
            var hwnd = w.Handle();
            Native.GetWindowRect(hwnd, out var r);
            int h = r.Bottom - r.Top;
            int x = work.Left + Math.Max(0, (work.Width - r.Width) / 2);
            int y = work.Top + Math.Max(0, (work.Bottom - work.Top - h) / 2);
            Native.MoveWindow(hwnd, x, y, topmost: false);
        };
    }
}

/// <summary>延时截图的倒计时（不会出现在截图里）。</summary>
public sealed class CountdownWindow : Window
{
    readonly TaskCompletionSource _tcs = new();
    public Task Completion => _tcs.Task;

    public CountdownWindow(int seconds)
    {
        ThemeMode = ThemeMode.None;
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        SizeToContent = SizeToContent.WidthAndHeight;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;

        var text = new TextBlock
        {
            Text = seconds.ToString(),
            FontSize = 64,
            FontWeight = FontWeights.Bold,
            Foreground = Brushes.White,
            HorizontalAlignment = HorizontalAlignment.Center,
        };
        var hint = new TextBlock
        {
            Text = "秒后截图，现在可以打开菜单",
            Foreground = Brushes.White,
            Opacity = 0.8,
            HorizontalAlignment = HorizontalAlignment.Center,
        };
        var stack = new StackPanel { Margin = new Thickness(28, 10, 28, 16) };
        stack.Children.Add(text);
        stack.Children.Add(hint);
        var panel = UiKit.Panel(stack);
        panel.Margin = new Thickness(14);
        Content = panel;

        SourceInitialized += (_, _) =>
        {
            Native.MakeClickThrough(this.Handle());
            Native.SetWindowDisplayAffinity(this.Handle(), Native.WDA_EXCLUDEFROMCAPTURE);
        };
        Loaded += async (_, _) =>
        {
            for (int s = seconds; s > 0; s--)
            {
                text.Text = s.ToString();
                await Task.Delay(1000);
            }
            Close();
            await Task.Delay(120);
            _tcs.TrySetResult();
        };
    }
}
