using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SnapTool.Capture;

/// <summary>BGRA32 像素数组，行与行紧密排列（stride = Width * 4）。</summary>
public sealed class RawImage(int width, int height, byte[] pixels)
{
    public int Width { get; } = width;
    public int Height { get; } = height;
    public byte[] Pixels { get; } = pixels;
    public int Stride => Width * 4;

    public BitmapSource ToBitmapSource()
    {
        var bmp = BitmapSource.Create(Width, Height, 96, 96, PixelFormats.Bgra32, null, Pixels, Stride);
        bmp.Freeze();
        return bmp;
    }

    public RawImage Crop(Int32Rect r)
    {
        var dst = new byte[r.Width * r.Height * 4];
        for (int y = 0; y < r.Height; y++)
            Buffer.BlockCopy(Pixels, ((r.Y + y) * Width + r.X) * 4, dst, y * r.Width * 4, r.Width * 4);
        return new RawImage(r.Width, r.Height, dst);
    }

    public Color GetPixel(int x, int y)
    {
        int i = (y * Width + x) * 4;
        return Color.FromRgb(Pixels[i + 2], Pixels[i + 1], Pixels[i]);
    }

    public static RawImage FromBitmapSource(BitmapSource src)
    {
        BitmapSource b = src.Format == PixelFormats.Bgra32 ? src : new FormatConvertedBitmap(src, PixelFormats.Bgra32, null, 0);
        var px = new byte[b.PixelWidth * b.PixelHeight * 4];
        b.CopyPixels(px, b.PixelWidth * 4, 0);
        return new RawImage(b.PixelWidth, b.PixelHeight, px);
    }
}

public static class ScreenCapture
{
    /// <summary>整个虚拟桌面（所有显示器）的范围，物理像素。</summary>
    public static Int32Rect VirtualScreen => new(
        Native.GetSystemMetrics(Native.SM_XVIRTUALSCREEN),
        Native.GetSystemMetrics(Native.SM_YVIRTUALSCREEN),
        Native.GetSystemMetrics(Native.SM_CXVIRTUALSCREEN),
        Native.GetSystemMetrics(Native.SM_CYVIRTUALSCREEN));

    public static RawImage CaptureVirtualScreen()
    {
        var v = VirtualScreen;
        return Capture(v.X, v.Y, v.Width, v.Height);
    }

    /// <summary>按屏幕坐标（物理像素）截取一块区域。</summary>
    public static RawImage Capture(int x, int y, int w, int h)
    {
        IntPtr screenDc = Native.GetDC(IntPtr.Zero);
        IntPtr memDc = Native.CreateCompatibleDC(screenDc);
        IntPtr hbm = Native.CreateCompatibleBitmap(screenDc, w, h);
        IntPtr old = Native.SelectObject(memDc, hbm);
        try
        {
            Native.BitBlt(memDc, 0, 0, w, h, screenDc, x, y, Native.SRCCOPY | Native.CAPTUREBLT);
            Native.SelectObject(memDc, old);

            var bmi = new Native.BITMAPINFOHEADER
            {
                biSize = 40,
                biWidth = w,
                biHeight = -h, // 负数 = 自上而下
                biPlanes = 1,
                biBitCount = 32,
            };
            var px = new byte[w * h * 4];
            Native.GetDIBits(memDc, hbm, 0, (uint)h, px, ref bmi, 0);
            for (int i = 3; i < px.Length; i += 4) px[i] = 255; // GDI 不填 alpha
            return new RawImage(w, h, px);
        }
        finally
        {
            Native.DeleteObject(hbm);
            Native.DeleteDC(memDc);
            Native.ReleaseDC(IntPtr.Zero, screenDc);
        }
    }
}
