using System.Windows.Input;
using System.Windows.Interop;

namespace SnapTool;

public readonly record struct Hotkey(ModifierKeys Modifiers, Key Key)
{
    public override string ToString()
    {
        var parts = new List<string>();
        if (Modifiers.HasFlag(ModifierKeys.Control)) parts.Add("Ctrl");
        if (Modifiers.HasFlag(ModifierKeys.Alt)) parts.Add("Alt");
        if (Modifiers.HasFlag(ModifierKeys.Shift)) parts.Add("Shift");
        if (Modifiers.HasFlag(ModifierKeys.Windows)) parts.Add("Win");
        parts.Add(KeyName(Key));
        return string.Join("+", parts);
    }

    static string KeyName(Key k) => k switch
    {
        >= Key.D0 and <= Key.D9 => ((char)('0' + (k - Key.D0))).ToString(),
        Key.Snapshot => "PrintScreen",
        _ => k.ToString(),
    };

    public static Hotkey? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var mods = ModifierKeys.None;
        Key key = Key.None;
        foreach (var raw in text.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            switch (raw.ToLowerInvariant())
            {
                case "ctrl": mods |= ModifierKeys.Control; break;
                case "alt": mods |= ModifierKeys.Alt; break;
                case "shift": mods |= ModifierKeys.Shift; break;
                case "win": mods |= ModifierKeys.Windows; break;
                case "printscreen": key = Key.Snapshot; break;
                default:
                    if (raw.Length == 1 && char.IsDigit(raw[0])) key = Key.D0 + (raw[0] - '0');
                    else if (!Enum.TryParse(raw, true, out key)) return null;
                    break;
            }
        }
        return key == Key.None ? null : new Hotkey(mods, key);
    }

    public uint NativeModifiers =>
        (Modifiers.HasFlag(ModifierKeys.Alt) ? Native.MOD_ALT : 0) |
        (Modifiers.HasFlag(ModifierKeys.Control) ? Native.MOD_CONTROL : 0) |
        (Modifiers.HasFlag(ModifierKeys.Shift) ? Native.MOD_SHIFT : 0) |
        (Modifiers.HasFlag(ModifierKeys.Windows) ? 0x8u : 0) |
        Native.MOD_NOREPEAT;

    public uint VirtualKey => (uint)KeyInterop.VirtualKeyFromKey(Key);
}

/// <summary>用一个隐藏的消息窗口接收全局快捷键。</summary>
public sealed class HotkeyManager : IDisposable
{
    readonly HwndSource _source;
    readonly Dictionary<int, Action> _actions = [];
    int _nextId = 1;

    public HotkeyManager()
    {
        var p = new HwndSourceParameters("SnapToolHotkeys")
        {
            Width = 0,
            Height = 0,
            WindowStyle = 0,
            ParentWindow = new IntPtr(-3), // HWND_MESSAGE
        };
        _source = new HwndSource(p);
        _source.AddHook(WndProc);
    }

    /// <summary>注册成功返回 id，被其他程序占用时返回 -1。</summary>
    public int Register(uint modifiers, uint vk, Action action)
    {
        int id = _nextId++;
        if (!Native.RegisterHotKey(_source.Handle, id, modifiers, vk)) return -1;
        _actions[id] = action;
        return id;
    }

    public int Register(Hotkey hk, Action action) => Register(hk.NativeModifiers, hk.VirtualKey, action);

    public void Unregister(int id)
    {
        if (id <= 0) return;
        Native.UnregisterHotKey(_source.Handle, id);
        _actions.Remove(id);
    }

    IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == Native.WM_HOTKEY && _actions.TryGetValue(wParam.ToInt32(), out var action))
        {
            handled = true;
            action();
        }
        return IntPtr.Zero;
    }

    public void Dispose()
    {
        foreach (var id in _actions.Keys.ToList()) Native.UnregisterHotKey(_source.Handle, id);
        _actions.Clear();
        _source.Dispose();
    }
}
