using System.Globalization;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Media.Imaging;

namespace SnapTool.Export;

/// <summary>把图片写成 PDF（每页一张 JPEG），长图可以按纸张大小自动分页。</summary>
public static class PdfBuilder
{
    sealed record Page(byte[] Jpeg, int PxW, int PxH, double PageW, double PageH, double X, double Y, double DrawW, double DrawH);

    public static byte[] Build(BitmapSource bmp, int quality, PdfPageMode mode, double dpi, out int pageCount)
    {
        var pages = new List<Page>();
        int W = bmp.PixelWidth, H = bmp.PixelHeight;

        if (mode == PdfPageMode.Original)
        {
            // 页面尺寸 = 像素 ÷ DPI（英寸）× 72（点）
            double pw = W * 72.0 / dpi, ph = H * 72.0 / dpi;
            pages.Add(new Page(ImageExport.EncodeJpeg(bmp, quality), W, H, pw, ph, 0, 0, pw, ph));
        }
        else
        {
            var (pw, ph) = mode switch
            {
                PdfPageMode.A4Landscape => (841.89, 595.28),
                PdfPageMode.LetterPortrait => (612.0, 792.0),
                _ => (595.28, 841.89),
            };
            const double margin = 18; // 0.25 英寸页边距
            double cw = pw - margin * 2, ch = ph - margin * 2;
            // 适应页宽；窄图最多放大到 DPI 对应尺寸的 1.5 倍，避免糊
            double scale = Math.Min(cw / W, 72.0 / dpi * 1.5);
            int slice = Math.Max(1, (int)Math.Floor(ch / scale));

            for (int y = 0; y < H; y += slice)
            {
                int hh = Math.Min(slice, H - y);
                var crop = new CroppedBitmap(bmp, new Int32Rect(0, y, W, hh));
                double dw = W * scale, dh = hh * scale;
                // PDF 坐标原点在左下角，图片贴着页面顶部放
                pages.Add(new Page(ImageExport.EncodeJpeg(crop, quality), W, hh, pw, ph, margin + (cw - dw) / 2, ph - margin - dh, dw, dh));
            }
        }

        pageCount = pages.Count;
        return Write(pages);
    }

    static byte[] Write(List<Page> pages)
    {
        var ms = new MemoryStream();
        var offsets = new List<long> { 0 };
        var inv = CultureInfo.InvariantCulture;

        void Text(string s)
        {
            var b = Encoding.ASCII.GetBytes(s);
            ms.Write(b, 0, b.Length);
        }
        void BeginObj(int n)
        {
            while (offsets.Count <= n) offsets.Add(0);
            offsets[n] = ms.Position;
            Text($"{n} 0 obj\n");
        }
        string N(double v) => v.ToString("0.###", inv);

        Text("%PDF-1.4\n");
        ms.Write([(byte)'%', 0xE2, 0xE3, 0xCF, 0xD3, (byte)'\n']);

        BeginObj(1);
        Text("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

        BeginObj(2);
        var kids = string.Join(" ", pages.Select((_, i) => $"{3 + i * 3} 0 R"));
        Text($"<< /Type /Pages /Kids [{kids}] /Count {pages.Count} >>\nendobj\n");

        for (int i = 0; i < pages.Count; i++)
        {
            var p = pages[i];
            int pageObj = 3 + i * 3, contentObj = pageObj + 1, imageObj = pageObj + 2;

            BeginObj(pageObj);
            Text($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {N(p.PageW)} {N(p.PageH)}] " +
                 $"/Resources << /XObject << /Im0 {imageObj} 0 R >> >> /Contents {contentObj} 0 R >>\nendobj\n");

            var content = $"q {N(p.DrawW)} 0 0 {N(p.DrawH)} {N(p.X)} {N(p.Y)} cm /Im0 Do Q\n";
            BeginObj(contentObj);
            Text($"<< /Length {content.Length} >>\nstream\n{content}endstream\nendobj\n");

            BeginObj(imageObj);
            Text($"<< /Type /XObject /Subtype /Image /Width {p.PxW} /Height {p.PxH} /ColorSpace /DeviceRGB " +
                 $"/BitsPerComponent 8 /Filter /DCTDecode /Length {p.Jpeg.Length} >>\nstream\n");
            ms.Write(p.Jpeg, 0, p.Jpeg.Length);
            Text("\nendstream\nendobj\n");
        }

        long xref = ms.Position;
        Text($"xref\n0 {offsets.Count}\n0000000000 65535 f \n");
        for (int n = 1; n < offsets.Count; n++) Text($"{offsets[n]:D10} 00000 n \n");
        Text($"trailer\n<< /Size {offsets.Count} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return ms.ToArray();
    }
}
