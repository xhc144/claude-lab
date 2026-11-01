using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using SnapTool.Capture;
using SnapTool.Editor;

namespace SnapTool;

public partial class App : Application
{
    public static AppSettings Settings { get; private set; } = new();
    public static new App Current => (App)Application.Current;

    public HotkeyManager Hotkeys { get; private set; } = null!;
    public TrayIcon Tray { get; private set; } = null!;

    /// <summary>每个快捷键是否注册成功（false = 被其他程序占用）。</summary>
    public Dictionary<string, bool> HotkeyStatus { get; } = [];

    readonly List<int> _hotkeyIds = [];
    Mutex? _mutex;
    EventWaitHandle? _showSignal;
    MainWindow? _main;
    bool _busy;
    bool _exiting;

    public bool IsExiting => _exiting;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        if (e.Args.Length > 0 && e.Args[0] == "--selftest")
        {
            SelfTest.Run(e.Args.Skip(1).ToArray());
            Shutdown();
            return;
        }
        if (e.Args.Length > 0 && e.Args[0] == "--longtest")
        {
            Hotkeys = new HotkeyManager();
            LongTest.Run(e.Args.Skip(1).ToArray()).ContinueWith(_ => Dispatcher.Invoke(Shutdown));
            return;
        }

        _mutex = new Mutex(true, @"Local\SnapTool.SingleInstance", out bool first);
        _showSignal = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\SnapTool.Show");
        if (!first)
        {
            // 已经在运行：通知那个实例把工具条叫出来，自己退出
            _showSignal.Set();
            Shutdown();
            return;
        }
        ThreadPool.RegisterWaitForSingleObject(_showSignal,
            (_, _) => Dispatcher.BeginInvoke(ShowMainWindow), null, Timeout.Infinite, executeOnlyOnce: false);

        DispatcherUnhandledException += (_, a) =>
        {
            MessageBox.Show(a.Exception.Message + "\n\n" + a.Exception.StackTrace, "SnapTool 出错了");
            a.Handled = true;
        };

        Settings = AppSettings.Load();
        Hotkeys = new HotkeyManager();
        RegisterHotkeys();
        Tray = new TrayIcon(this);
        _main = new MainWindow();

        string? file = e.Args.FirstOrDefault(a => !a.StartsWith("--"));
        if (file != null && File.Exists(file)) OpenImageFile(file);
        else if (!e.Args.Contains("--tray") && Settings.ShowToolbarOnStart) ShowMainWindow();
        else Tray.Notify($"SnapTool 已在托盘运行，按 {Settings.HotkeyRegion} 截图，点托盘图标打开工具条。");
    }

    public void RegisterHotkeys()
    {
        foreach (var id in _hotkeyIds) Hotkeys.Unregister(id);
        _hotkeyIds.Clear();
        HotkeyStatus.Clear();

        Reg("region", Settings.HotkeyRegion, () => StartRegionCapture());
        Reg("long", Settings.HotkeyLong, () => StartRegionCapture(longMode: true));
        Reg("full", Settings.HotkeyFull, StartFullScreenCapture);

        void Reg(string name, string text, Action action)
        {
            if (Hotkey.Parse(text) is not { } hk) { HotkeyStatus[name] = false; return; }
            int id = Hotkeys.Register(hk, action);
            HotkeyStatus[name] = id > 0;
            if (id > 0) _hotkeyIds.Add(id);
        }
    }

    // ---------------- 截图流程 ----------------

    /// <summary>工具条只是个启动器：开始截图就收起来，截完也不再自动出现，免得挡住编辑窗口。</summary>
    async Task HideMainForCaptureAsync()
    {
        if (_main is { IsVisible: true })
        {
            _main.Hide();
            await Task.Delay(220); // 等窗口淡出动画结束，避免截进画面
        }
    }

    public async void StartRegionCapture(bool longMode = false)
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await HideMainForCaptureAsync();
            var virt = ScreenCapture.VirtualScreen;
            var shot = ScreenCapture.CaptureVirtualScreen();
            var windows = WindowFinder.GetWindowRects(virt);

            var overlay = new CaptureOverlay(shot, virt, windows, longMode);
            overlay.Closed += (_, _) => OnOverlayClosed(overlay);
            overlay.Show();
        }
        catch
        {
            _busy = false;
            throw;
        }
    }

    void OnOverlayClosed(CaptureOverlay overlay)
    {
        var img = overlay.Result;
        switch (overlay.Action)
        {
            case OverlayAction.Edit when img != null:
                new EditorWindow(img).Show();
                break;
            case OverlayAction.Copy when img != null:
                ImageActions.CopyToClipboard(img);
                Tray.Notify($"已复制到剪贴板（{img.PixelWidth} × {img.PixelHeight}）");
                break;
            case OverlayAction.Save when img != null:
                var path = ImageActions.QuickSave(img);
                Tray.Notify($"已保存：{Path.GetFileName(path)}\n点击这里打开所在文件夹", path);
                break;
            case OverlayAction.Pin when img != null:
                new PinWindow(img, overlay.ScreenSelection).Show();
                break;
            case OverlayAction.Long:
                StartLongCapture(overlay.ScreenSelection);
                return; // 长截图结束后再恢复
        }
        _busy = false;
    }

    void StartLongCapture(Int32Rect screenRect)
    {
        var session = new LongCaptureSession(screenRect, result =>
        {
            _busy = false;
            if (result == null) return;
            var editor = new EditorWindow(result);
            editor.Show();
            editor.Activate(); // 滚动时焦点在被截的程序上，编辑窗口要主动拿到前台
        });
        session.Start();
    }

    public async void StartFullScreenCapture()
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await HideMainForCaptureAsync();
            var shot = ScreenCapture.CaptureVirtualScreen();
            new EditorWindow(shot.ToBitmapSource()).Show();
        }
        finally
        {
            _busy = false;
        }
    }

    public async void StartDelayedCapture(int seconds)
    {
        if (_busy) return;
        await HideMainForCaptureAsync();
        var countdown = new CountdownWindow(seconds);
        countdown.Show();
        await countdown.Completion;
        StartRegionCapture();
    }

    // ---------------- 文件 ----------------

    public void OpenImageDialog()
    {
        var dlg = new OpenFileDialog
        {
            Title = "打开图片",
            Filter = "图片|*.png;*.jpg;*.jpeg;*.bmp;*.gif;*.tif;*.tiff;*.webp;*.ico|所有文件|*.*",
        };
        if (dlg.ShowDialog() == true) OpenImageFile(dlg.FileName);
    }

    public void OpenImageFile(string path)
    {
        try
        {
            new EditorWindow(ImageActions.Load(path), path).Show();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"无法打开这个文件：\n{ex.Message}", "SnapTool");
        }
    }

    public void OpenSaveFolder()
    {
        Directory.CreateDirectory(Settings.SaveFolder);
        Process.Start("explorer.exe", $"\"{Settings.SaveFolder}\"");
    }

    public void ShowMainWindow()
    {
        if (_busy) return;
        _main?.ShowAtCursor();
    }

    public void ShowSettings() => _main?.ShowSettings();

    public void ExitApp()
    {
        _exiting = true;
        Tray?.Dispose();
        Hotkeys?.Dispose();
        Shutdown();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        Tray?.Dispose();
        _mutex?.Dispose();
        base.OnExit(e);
    }
}
