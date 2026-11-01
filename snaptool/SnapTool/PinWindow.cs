using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using SnapTool.Editor;

namespace SnapTool;

/// <summary>钉在桌面最上层的截图：拖动移动、滚轮缩放、Ctrl+滚轮调透明度、双击关闭。</summary>
public sealed class PinWindow : Window
{
    readonly BitmapSource _img;
    readonly Int32Rect? _at;
    double _scale = 1;

    public PinWindow(BitmapSource img, Int32Rect? screenRect = null)
    {
        _img = img;
        _at = screenRect;

        ThemeMode = ThemeMode.None;
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        ShowInTaskbar = false;
        Title = "SnapTool 钉图";
        Width = img.PixelWidth;
        Height = img.PixelHeight;
        WindowStartupLocation = WindowStartupLocation.Manual;

        var image = new Image { Source = img, Stretch = Stretch.Fill };
        RenderOptions.SetBitmapScalingMode(image, BitmapScalingMode.HighQuality);
        var grid = new Grid();
        grid.Children.Add(image);
        grid.Children.Add(new Rectangle
        {
            Stroke = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0xB0, 0x3B, 0x82, 0xF6))),
            StrokeThickness = 1,
            IsHitTestVisible = false,
        });
        Content = grid;
        ToolTip = "拖动移动 · 滚轮缩放 · Ctrl+滚轮调透明度 · 双击或 Esc 关闭 · 右键更多";

        ContextMenu = BuildMenu();

        SourceInitialized += (_, _) =>
        {
            var hwnd = this.Handle();
            HwndSource.FromHwnd(hwnd)!.AddHook(WndProc);
            Native.MakeToolWindow(hwnd);
            int x, y;
            if (_at is { } r) { x = r.X; y = r.Y; }
            else
            {
                Native.GetCursorPos(out var p);
                x = p.X - img.PixelWidth / 2;
                y = p.Y - img.PixelHeight / 2;
            }
            Native.PlaceWindow(hwnd, x, y, img.PixelWidth, img.PixelHeight);
        };
        MouseLeftButtonDown += (_, e) =>
        {
            if (e.ClickCount == 2) Close();
            else DragMove();
        };
        KeyDown += (_, e) =>
        {
            if (e.Key == Key.Escape) Close();
            else if (e.Key == Key.C && Keyboard.Modifiers == ModifierKeys.Control) ImageActions.CopyToClipboard(_img);
        };
        MouseWheel += (_, e) =>
        {
            if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control))
                Opacity = Math.Clamp(Opacity + (e.Delta > 0 ? 0.1 : -0.1), 0.2, 1);
            else
                SetScale(_scale * (e.Delta > 0 ? 1.1 : 1 / 1.1));
        };
    }

    ContextMenu BuildMenu()
    {
        var menu = new ContextMenu();
        Add("复制", () => ImageActions.CopyToClipboard(_img));
        Add("保存到默认目录", () =>
        {
            var path = ImageActions.QuickSave(_img);
            App.Current.Tray.Notify($"已保存：{System.IO.Path.GetFileName(path)}", path);
        });
        Add("在编辑器中打开", () => new EditorWindow(_img).Show());
        menu.Items.Add(new Separator());
        Add("原始大小", () => SetScale(1));
        Add("不透明", () => Opacity = 1);
        Add("半透明", () => Opacity = 0.5);
        menu.Items.Add(new Separator());
        Add("关闭", Close);
        return menu;

        void Add(string header, Action action)
        {
            var item = new MenuItem { Header = header };
            item.Click += (_, _) => action();
            menu.Items.Add(item);
        }
    }

    void SetScale(double s)
    {
        _scale = Math.Clamp(s, 0.1, 8);
        var hwnd = this.Handle();
        Native.GetWindowRect(hwnd, out var r);
        Native.PlaceWindow(hwnd, r.Left, r.Top,
            Math.Max(8, (int)Math.Round(_img.PixelWidth * _scale)),
            Math.Max(8, (int)Math.Round(_img.PixelHeight * _scale)));
    }

    IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        // 拖到不同缩放比例的显示器上时保持物理像素大小不变，截图才是 1:1
        if (msg == Native.WM_DPICHANGED)
        {
            handled = true;
            Dispatcher.BeginInvoke(() => SetScale(_scale));
        }
        return IntPtr.Zero;
    }
}
