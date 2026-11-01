using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SnapTool.Export;

public enum ExportFormat { Png, Jpg, Bmp, Tiff, Pdf }

public enum PdfPageMode { Original, A4Portrait, A4Landscape, LetterPortrait }

public sealed record ExportOptions(
    int Width,
    int Height,
    BitmapScalingMode Scaling,
    double Dpi,
    ExportFormat Format,
    int Quality,
    long? MaxBytes,
    PdfPageMode PdfPage);

public sealed record ExportResult(byte[] Data, int Width, int Height, int Quality, int Pages, bool LimitMet);

public static class ImageExport
{
    public static string Extension(ExportFormat f) => f switch
    {
        ExportFormat.Jpg => ".jpg",
        ExportFormat.Bmp => ".bmp",
        ExportFormat.Tiff => ".tif",
        ExportFormat.Pdf => ".pdf",
        _ => ".png",
    };

    public static bool IsLossy(ExportFormat f) => f is ExportFormat.Jpg or ExportFormat.Pdf;

    public static byte[] EncodeSimple(BitmapSource bmp, ExportFormat format) =>
        Encode(bmp, format, 92, 96, PdfPageMode.Original, out _);

    /// <summary>
    /// 按选项导出。render(w, h) 负责把原图和标注合成为指定像素大小的位图。
    /// 设置了体积上限时：有损格式先降质量，降到最低还超就缩小尺寸；无损格式直接按比例缩小尺寸。
    /// </summary>
    public static ExportResult Export(Func<int, int, BitmapSource> render, ExportOptions o)
    {
        int w = o.Width, h = o.Height;
        var bmp = render(w, h);
        var data = Encode(bmp, o.Format, o.Quality, o.Dpi, o.PdfPage, out int pages);
        if (o.MaxBytes is not long max || data.Length <= max)
            return new ExportResult(data, w, h, o.Quality, pages, true);

        for (int attempt = 0; attempt < 14; attempt++)
        {
            if (IsLossy(o.Format))
            {
                // 二分查找满足体积的最高质量
                int lo = 5, hi = o.Quality - 1, bestQ = -1, bestPages = 1;
                byte[]? best = null;
                while (lo <= hi)
                {
                    int mid = (lo + hi) / 2;
                    var d = Encode(bmp, o.Format, mid, o.Dpi, o.PdfPage, out int pg);
                    if (d.Length <= max) { best = d; bestQ = mid; bestPages = pg; lo = mid + 1; }
                    else hi = mid - 1;
                }
                if (best != null && bestQ >= 35) return new ExportResult(best, w, h, bestQ, bestPages, true);
                // 质量要压到很低才行时，宁可缩小尺寸、保持较好的清晰度
                var probe = Encode(bmp, o.Format, 60, o.Dpi, o.PdfPage, out _);
                double scale = Math.Clamp(Math.Sqrt(max / (double)probe.Length) * 0.95, 0.3, 0.92);
                w = Math.Max(1, (int)(w * scale));
                h = Math.Max(1, (int)(h * scale));
            }
            else
            {
                double scale = Math.Clamp(Math.Sqrt(max / (double)data.Length) * 0.97, 0.2, 0.95);
                w = Math.Max(1, (int)(w * scale));
                h = Math.Max(1, (int)(h * scale));
            }

            bmp = render(w, h);
            int q = IsLossy(o.Format) ? Math.Min(o.Quality, 85) : o.Quality;
            data = Encode(bmp, o.Format, q, o.Dpi, o.PdfPage, out pages);
            if (data.Length <= max) return new ExportResult(data, w, h, q, pages, true);
            if (w < 16 || h < 16) break;
        }
        return new ExportResult(data, w, h, o.Quality, pages, false);
    }

    public static byte[] Encode(BitmapSource bmp, ExportFormat format, int quality, double dpi, PdfPageMode pdfPage, out int pages)
    {
        pages = 1;
        if (format == ExportFormat.Pdf)
            return PdfBuilder.Build(bmp, quality, pdfPage, dpi, out pages);

        var src = WithDpi(bmp, dpi);
        BitmapEncoder encoder = format switch
        {
            ExportFormat.Jpg => new JpegBitmapEncoder { QualityLevel = Math.Clamp(quality, 1, 100) },
            ExportFormat.Bmp => new BmpBitmapEncoder(),
            ExportFormat.Tiff => new TiffBitmapEncoder { Compression = TiffCompressOption.Lzw },
            _ => new PngBitmapEncoder(),
        };
        if (format is ExportFormat.Jpg or ExportFormat.Bmp) src = Flatten(src);
        encoder.Frames.Add(BitmapFrame.Create(src));
        using var ms = new MemoryStream();
        encoder.Save(ms);
        return ms.ToArray();
    }

    public static byte[] EncodeJpeg(BitmapSource bmp, int quality)
    {
        var enc = new JpegBitmapEncoder { QualityLevel = Math.Clamp(quality, 1, 100) };
        enc.Frames.Add(BitmapFrame.Create(Flatten(bmp)));
        using var ms = new MemoryStream();
        enc.Save(ms);
        return ms.ToArray();
    }

    /// <summary>写入 DPI（打印尺寸），不改变像素。</summary>
    public static BitmapSource WithDpi(BitmapSource bmp, double dpi)
    {
        if (Math.Abs(bmp.DpiX - dpi) < 0.01 && Math.Abs(bmp.DpiY - dpi) < 0.01) return bmp;
        var b = bmp.Format == PixelFormats.Pbgra32 || bmp.Format == PixelFormats.Bgra32 || bmp.Format == PixelFormats.Bgr32
            ? bmp
            : new FormatConvertedBitmap(bmp, PixelFormats.Bgra32, null, 0);
        int stride = b.PixelWidth * 4;
        var px = new byte[stride * b.PixelHeight];
        b.CopyPixels(px, stride, 0);
        var result = BitmapSource.Create(b.PixelWidth, b.PixelHeight, dpi, dpi, b.Format, null, px, stride);
        result.Freeze();
        return result;
    }

    /// <summary>去掉透明通道（透明处填白），JPG / BMP / PDF 用。</summary>
    public static BitmapSource Flatten(BitmapSource bmp)
    {
        if (HasTransparency(bmp))
        {
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen())
            {
                var rect = new Rect(0, 0, bmp.PixelWidth, bmp.PixelHeight);
                dc.DrawRectangle(Brushes.White, null, rect);
                dc.DrawImage(bmp, rect);
            }
            var rtb = new RenderTargetBitmap(bmp.PixelWidth, bmp.PixelHeight, bmp.DpiX, bmp.DpiY, PixelFormats.Pbgra32);
            rtb.Render(dv);
            bmp = rtb;
        }
        var conv = new FormatConvertedBitmap(bmp, PixelFormats.Bgr24, null, 0);
        conv.Freeze();
        return conv;
    }

    static bool HasTransparency(BitmapSource bmp)
    {
        if (bmp.Format != PixelFormats.Bgra32 && bmp.Format != PixelFormats.Pbgra32)
            return bmp.Format.Masks.Count == 4 && bmp.Format != PixelFormats.Bgr32;
        int stride = bmp.PixelWidth * 4;
        var row = new byte[stride];
        for (int y = 0; y < bmp.PixelHeight; y++)
        {
            bmp.CopyPixels(new Int32Rect(0, y, bmp.PixelWidth, 1), row, stride, 0);
            for (int i = 3; i < row.Length; i += 4)
                if (row[i] != 255) return true;
        }
        return false;
    }

    public static string FormatSize(long bytes) => bytes switch
    {
        < 1024 => $"{bytes} B",
        < 1024 * 1024 => $"{bytes / 1024.0:0.#} KB",
        _ => $"{bytes / 1024.0 / 1024.0:0.##} MB",
    };
}
