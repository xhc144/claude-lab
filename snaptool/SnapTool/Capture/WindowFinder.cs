using System.Runtime.InteropServices;
using System.Windows;

namespace SnapTool.Capture;

/// <summary>截图前记录所有可见窗口的位置，鼠标悬停时用来自动框选窗口。</summary>
public static class WindowFinder
{
    /// <summary>返回按 Z 序（最上层在前）排列的窗口矩形，坐标相对于虚拟桌面左上角。</summary>
    public static List<Int32Rect> GetWindowRects(Int32Rect virt)
    {
        var result = new List<Int32Rect>();
        uint ownPid = (uint)Environment.ProcessId;

        Native.EnumWindows((hwnd, _) =>
        {
            if (!Native.IsWindowVisible(hwnd) || Native.IsIconic(hwnd)) return true;
            Native.GetWindowThreadProcessId(hwnd, out uint pid);
            if (pid == ownPid) return true;
            if (Native.DwmGetWindowAttribute(hwnd, Native.DWMWA_CLOAKED, out int cloaked, sizeof(int)) == 0 && cloaked != 0)
                return true;

            // 扩展边框范围不含 Win10/11 的透明阴影，比 GetWindowRect 准
            if (Native.DwmGetWindowAttribute(hwnd, Native.DWMWA_EXTENDED_FRAME_BOUNDS, out Native.RECT r, Marshal.SizeOf<Native.RECT>()) != 0)
                Native.GetWindowRect(hwnd, out r);

            int left = Math.Max(r.Left, virt.X), top = Math.Max(r.Top, virt.Y);
            int right = Math.Min(r.Right, virt.X + virt.Width), bottom = Math.Min(r.Bottom, virt.Y + virt.Height);
            if (right - left < 20 || bottom - top < 20) return true;

            result.Add(new Int32Rect(left - virt.X, top - virt.Y, right - left, bottom - top));
            return true;
        }, IntPtr.Zero);

        return result;
    }
}
