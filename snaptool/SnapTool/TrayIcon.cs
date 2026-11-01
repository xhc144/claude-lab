using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using Forms = System.Windows.Forms;

namespace SnapTool;

/// <summary>任务栏右下角的托盘图标。右键菜单用自己画的 <see cref="TrayMenu"/>，和程序其他界面风格一致。</summary>
public sealed class TrayIcon : IDisposable
{
    readonly Forms.NotifyIcon _icon;
    readonly App _app;
    TrayMenu? _menu;
    string? _lastFile;

    public TrayIcon(App app)
    {
        _app = app;
        var stream = Application.GetResourceStream(new Uri("pack://application:,,,/Assets/app.ico")).Stream;
        _icon = new Forms.NotifyIcon
        {
            Icon = new System.Drawing.Icon(stream, Forms.SystemInformation.SmallIconSize),
            Text = "SnapTool 截图",
            Visible = true,
        };
        _icon.MouseUp += (_, e) =>
        {
            if (e.Button == Forms.MouseButtons.Left) app.ShowMainWindow();
            else if (e.Button == Forms.MouseButtons.Right) ShowMenu();
        };
        _icon.BalloonTipClicked += (_, _) =>
        {
            if (_lastFile != null && File.Exists(_lastFile))
                Process.Start("explorer.exe", $"/select,\"{_lastFile}\"");
        };
    }

    void ShowMenu()
    {
        _menu?.Close();
        var s = App.Settings;
        _menu = new TrayMenu(
        [
            new("", "区域截图", s.HotkeyRegion, () => _app.StartRegionCapture()),
            new("", "长截图", s.HotkeyLong, () => _app.StartRegionCapture(longMode: true)),
            new("", "全屏截图", s.HotkeyFull, _app.StartFullScreenCapture),
            new("", "3 秒后截图", "", () => _app.StartDelayedCapture(3)),
            null,
            new("", "打开图片…", "", _app.OpenImageDialog),
            new("", "打开保存目录", "", _app.OpenSaveFolder),
            new("", "显示工具条", "", _app.ShowMainWindow),
            new("", "设置", "", _app.ShowSettings),
            null,
            new("", "退出", "", _app.ExitApp),
        ]);
        _menu.Closed += (_, _) => _menu = null;
        _menu.ShowAtCursor();
    }

    /// <summary>右下角弹出提示；带文件路径时点击提示会在资源管理器中定位该文件。</summary>
    public void Notify(string text, string? file = null)
    {
        _lastFile = file;
        _icon.ShowBalloonTip(2500, "SnapTool", text, Forms.ToolTipIcon.None);
    }

    public void Dispose()
    {
        _menu?.Close();
        _icon.Visible = false;
        _icon.Dispose();
    }
}

public sealed record TrayMenuItem(string Glyph, string Text, string Shortcut, Action Run);

/// <summary>深色圆角的托盘菜单：图标 + 文字 + 右侧快捷键，点到别处自动关闭。</summary>
public sealed class TrayMenu : Window
{
    static readonly Brush HoverBrush = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0x24, 0xFF, 0xFF, 0xFF)));
    static readonly Brush DimBrush = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0x80, 0xFF, 0xFF, 0xFF)));
    bool _closing;

    public TrayMenu(IReadOnlyList<TrayMenuItem?> items)
    {
        ThemeMode = ThemeMode.None;
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        ShowInTaskbar = false;
        SizeToContent = SizeToContent.WidthAndHeight;
        FontFamily = new FontFamily("Microsoft YaHei UI");
        UseLayoutRounding = true;

        var list = new StackPanel { MinWidth = 220 };
        foreach (var item in items)
            list.Children.Add(item == null ? Separator() : Row(item));

        var panel = UiKit.Panel(list);
        panel.Padding = new Thickness(5);
        panel.Margin = new Thickness(14); // 给阴影留位置
        TextElement.SetForeground(panel, Brushes.White);
        Content = panel;

        SourceInitialized += (_, _) => Native.SetWindowDisplayAffinity(this.Handle(), Native.WDA_EXCLUDEFROMCAPTURE);
        Deactivated += (_, _) => SafeClose();
        KeyDown += (_, e) =>
        {
            if (e.Key == Key.Escape) SafeClose();
        };
    }

    UIElement Row(TrayMenuItem item)
    {
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(30) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var icon = new TextBlock { Text = item.Glyph, FontFamily = UiKit.IconFont, FontSize = 15, VerticalAlignment = VerticalAlignment.Center };
        var text = new TextBlock { Text = item.Text, FontSize = 13.5, VerticalAlignment = VerticalAlignment.Center };
        var key = new TextBlock
        {
            Text = item.Shortcut,
            FontSize = 12,
            Foreground = DimBrush,
            Margin = new Thickness(24, 0, 2, 0),
            VerticalAlignment = VerticalAlignment.Center,
        };
        Grid.SetColumn(text, 1);
        Grid.SetColumn(key, 2);
        grid.Children.Add(icon);
        grid.Children.Add(text);
        grid.Children.Add(key);

        var row = new Border
        {
            Child = grid,
            Height = 36,
            Padding = new Thickness(10, 0, 12, 0),
            CornerRadius = new CornerRadius(7),
            Background = Brushes.Transparent,
            Cursor = Cursors.Hand,
        };
        row.MouseEnter += (_, _) => row.Background = HoverBrush;
        row.MouseLeave += (_, _) => row.Background = Brushes.Transparent;
        row.MouseLeftButtonUp += async (_, _) =>
        {
            SafeClose();
            await Task.Delay(60); // 菜单先消失，再开始截图
            item.Run();
        };
        return row;
    }

    static UIElement Separator() => new Border
    {
        Height = 1,
        Margin = new Thickness(10, 5, 10, 5),
        Background = UiKit.Freeze(new SolidColorBrush(Color.FromArgb(0x26, 0xFF, 0xFF, 0xFF))),
    };

    /// <summary>在鼠标处弹出：默认在鼠标左上方（托盘在右下角），放不下再换方向。</summary>
    public void ShowAtCursor()
    {
        Native.GetCursorPos(out var p);
        Left = -10000;
        Top = -10000;
        Show();
        UpdateLayout();

        var hwnd = this.Handle();
        Native.GetWindowRect(hwnd, out var me);
        var work = Native.WorkAreaAt(p.X, p.Y);
        const int shadow = 14; // 窗口四周透明的阴影边距，按 DIP 算，换成像素
        int pad = (int)(shadow * VisualTreeHelper.GetDpi(this).DpiScaleX);
        int x = p.X - me.Width + pad;
        int y = p.Y - me.Height + pad;
        if (x < work.Left - pad) x = p.X - pad;
        if (y < work.Top - pad) y = p.Y - pad;
        x = Math.Clamp(x, work.Left - pad, Math.Max(work.Left - pad, work.Right - me.Width + pad));
        y = Math.Clamp(y, work.Top - pad, Math.Max(work.Top - pad, work.Bottom - me.Height + pad));
        Native.MoveWindow(hwnd, x, y);
        Activate();
        Native.SetForegroundWindow(hwnd);
    }

    void SafeClose()
    {
        if (_closing) return;
        _closing = true;
        Close();
    }
}
