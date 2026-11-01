using System.ComponentModel;
using System.Windows;
using System.Windows.Input;

namespace SnapTool;

/// <summary>主界面：一条浮动工具条。需要时在鼠标旁边弹出，点到别处就自动收起。</summary>
public partial class MainWindow : Window
{
    SettingsWindow? _settings;

    public MainWindow()
    {
        InitializeComponent();
        RefreshHotkeyTips();
        Deactivated += (_, _) =>
        {
            if (!App.Current.IsExiting && !_dragging) Hide();
        };
    }

    /// <summary>在鼠标所在位置弹出工具条（限制在当前屏幕的工作区内）。</summary>
    public void ShowAtCursor()
    {
        Show();
        UpdateLayout();
        var hwnd = this.Handle();
        Native.GetCursorPos(out var p);
        Native.GetWindowRect(hwnd, out var me);
        var work = Native.WorkAreaAt(p.X, p.Y);
        int x = Math.Clamp(p.X - me.Width / 2, work.Left, Math.Max(work.Left, work.Right - me.Width));
        int y = Math.Clamp(p.Y - me.Height / 2, work.Top, Math.Max(work.Top, work.Bottom - me.Height));
        Native.MoveWindow(hwnd, x, y);
        Activate();
        Native.SetForegroundWindow(hwnd);
    }

    public void RefreshHotkeyTips()
    {
        var s = App.Settings;
        RegionButton.ToolTip = Tip("区域截图", s.HotkeyRegion, "region");
        LongButton.ToolTip = Tip("长截图（自动滚动拼接）", s.HotkeyLong, "long");
        FullButton.ToolTip = Tip("全屏截图", s.HotkeyFull, "full");

        static string Tip(string name, string key, string id)
        {
            if (string.IsNullOrEmpty(key)) return name;
            bool ok = App.Current.HotkeyStatus.GetValueOrDefault(id);
            return ok ? $"{name}    {key}" : $"{name}    {key}（快捷键被占用）";
        }
    }

    bool _dragging;

    void Bar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        _dragging = true;
        try { DragMove(); }
        finally { _dragging = false; }
    }

    void Region_Click(object sender, RoutedEventArgs e) => App.Current.StartRegionCapture();
    void Long_Click(object sender, RoutedEventArgs e) => App.Current.StartRegionCapture(longMode: true);
    void Full_Click(object sender, RoutedEventArgs e) => App.Current.StartFullScreenCapture();
    void Delay_Click(object sender, RoutedEventArgs e) => App.Current.StartDelayedCapture(3);
    void Open_Click(object sender, RoutedEventArgs e) => App.Current.OpenImageDialog();
    void Folder_Click(object sender, RoutedEventArgs e) => App.Current.OpenSaveFolder();
    void Exit_Click(object sender, RoutedEventArgs e) => App.Current.ExitApp();

    void Settings_Click(object sender, RoutedEventArgs e) => ShowSettings();

    public void ShowSettings()
    {
        if (_settings is { IsLoaded: true })
        {
            _settings.Activate();
            return;
        }
        _settings = new SettingsWindow();
        _settings.Closed += (_, _) =>
        {
            _settings = null;
            RefreshHotkeyTips();
        };
        _settings.Show();
    }

    bool _trayHintShown;

    void Hide_Click(object sender, RoutedEventArgs e)
    {
        Hide();
        if (!_trayHintShown)
        {
            _trayHintShown = true;
            App.Current.Tray.Notify("工具条已收起，快捷键随时可用。点托盘图标或桌面快捷方式可以再叫出来。");
        }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        // Alt+F4 也只是收起，真正退出用 × 按钮或托盘菜单
        if (!App.Current.IsExiting)
        {
            e.Cancel = true;
            Hide();
            return;
        }
        base.OnClosing(e);
    }
}
