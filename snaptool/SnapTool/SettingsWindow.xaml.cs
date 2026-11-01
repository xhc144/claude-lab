using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Win32;

namespace SnapTool;

public partial class SettingsWindow : Window
{
    public SettingsWindow()
    {
        InitializeComponent();
        this.FitToWorkArea();
        var s = App.Settings;
        FolderBox.Text = s.SaveFolder;
        FormatBox.SelectedIndex = s.QuickSaveFormat == "JPG" ? 1 : 0;
        ShowBarBox.IsChecked = s.ShowToolbarOnStart;
        AutoStartBox.IsChecked = AppSettings.AutoStart;
        RefreshHotkeys();
    }

    void RefreshHotkeys()
    {
        var s = App.Settings;
        Show(RegionKeyBox, RegionKeyState, s.HotkeyRegion, "region");
        Show(LongKeyBox, LongKeyState, s.HotkeyLong, "long");
        Show(FullKeyBox, FullKeyState, s.HotkeyFull, "full");

        static void Show(TextBox box, TextBlock state, string key, string name)
        {
            box.Text = string.IsNullOrEmpty(key) ? "（未设置）" : key;
            bool ok = App.Current.HotkeyStatus.GetValueOrDefault(name);
            state.Text = string.IsNullOrEmpty(key) ? "" : ok ? "可用" : "被占用";
            state.Foreground = ok ? new SolidColorBrush(Color.FromRgb(0x4A, 0xDE, 0x80)) : new SolidColorBrush(Color.FromRgb(0xF8, 0x71, 0x71));
        }
    }

    void ChangeFolder_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFolderDialog { Title = "选择截图保存位置", InitialDirectory = App.Settings.SaveFolder };
        if (dlg.ShowDialog(this) != true) return;
        App.Settings.SaveFolder = dlg.FolderName;
        App.Settings.Save();
        FolderBox.Text = dlg.FolderName;
    }

    void FormatBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!IsLoaded) return;
        App.Settings.QuickSaveFormat = FormatBox.SelectedIndex == 1 ? "JPG" : "PNG";
        App.Settings.Save();
    }

    void HotkeyBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        var box = (TextBox)sender;
        Key key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (key is Key.Tab) return;
        e.Handled = true;
        if (key is Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LeftShift or Key.RightShift or Key.LWin or Key.RWin)
            return; // 等待真正的按键

        string text;
        if (key is Key.Back or Key.Delete && Keyboard.Modifiers == ModifierKeys.None) text = "";
        else
        {
            var mods = Keyboard.Modifiers;
            bool isFunctionKey = key is >= Key.F1 and <= Key.F24 or Key.Snapshot;
            if (mods == ModifierKeys.None && !isFunctionKey) return; // 单个字母做全局快捷键会干扰打字
            text = new Hotkey(mods, key).ToString();
        }

        switch (box.Tag as string)
        {
            case "region": App.Settings.HotkeyRegion = text; break;
            case "long": App.Settings.HotkeyLong = text; break;
            case "full": App.Settings.HotkeyFull = text; break;
        }
        App.Settings.Save();
        App.Current.RegisterHotkeys();
        RefreshHotkeys();
    }

    void ShowBarBox_Click(object sender, RoutedEventArgs e)
    {
        App.Settings.ShowToolbarOnStart = ShowBarBox.IsChecked == true;
        App.Settings.Save();
    }

    void AutoStartBox_Click(object sender, RoutedEventArgs e) => AppSettings.AutoStart = AutoStartBox.IsChecked == true;
}
