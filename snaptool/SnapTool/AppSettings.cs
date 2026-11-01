using System.IO;
using System.Text.Json;
using Microsoft.Win32;

namespace SnapTool;

public sealed class AppSettings
{
    public string SaveFolder { get; set; } =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "SnapTool");

    /// <summary>快速保存使用的格式：PNG 或 JPG。</summary>
    public string QuickSaveFormat { get; set; } = "PNG";

    public bool ShowToolbarOnStart { get; set; } = true;
    public double? ToolbarLeft { get; set; }
    public double? ToolbarTop { get; set; }

    public string HotkeyRegion { get; set; } = "Ctrl+Alt+X";
    public string HotkeyLong { get; set; } = "Ctrl+Alt+L";
    public string HotkeyFull { get; set; } = "Ctrl+Alt+F";

    static string FilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SnapTool", "settings.json");

    public static AppSettings Load()
    {
        try
        {
            if (File.Exists(FilePath))
                return JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(FilePath)) ?? new AppSettings();
        }
        catch
        {
            // 设置文件损坏时用默认值
        }
        return new AppSettings();
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
    }

    // ---- 开机自启（写在当前用户的 Run 键下，不需要管理员权限）----
    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

    public static bool AutoStart
    {
        get
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey);
            return key?.GetValue("SnapTool") is string;
        }
        set
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKey);
            if (value) key.SetValue("SnapTool", $"\"{Environment.ProcessPath}\" --tray");
            else key.DeleteValue("SnapTool", false);
        }
    }
}
