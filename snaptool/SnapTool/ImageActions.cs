using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media.Imaging;
using SnapTool.Export;

namespace SnapTool;

public static class ImageActions
{
    public static void CopyToClipboard(BitmapSource bmp)
    {
        var data = new DataObject();
        data.SetImage(bmp);
        // 额外放一份 PNG，Office、浏览器、聊天软件粘贴时能保留清晰度和透明度
        var png = new MemoryStream(ImageExport.EncodeSimple(bmp, ExportFormat.Png));
        data.SetData("PNG", png, false);

        for (int i = 0; i < 10; i++)
        {
            try
            {
                Clipboard.SetDataObject(data, true);
                return;
            }
            catch (COMException)
            {
                Thread.Sleep(60); // 剪贴板被别的程序占用，稍后重试
            }
        }
        MessageBox.Show("剪贴板正被其他程序占用，复制失败，请再试一次。", "SnapTool");
    }

    /// <summary>按设置里的目录和格式直接保存，返回文件路径。</summary>
    public static string QuickSave(BitmapSource bmp)
    {
        var fmt = App.Settings.QuickSaveFormat == "JPG" ? ExportFormat.Jpg : ExportFormat.Png;
        Directory.CreateDirectory(App.Settings.SaveFolder);
        string path = UniquePath(App.Settings.SaveFolder, $"SnapTool_{DateTime.Now:yyyyMMdd_HHmmss}", ImageExport.Extension(fmt));
        File.WriteAllBytes(path, ImageExport.EncodeSimple(bmp, fmt));
        return path;
    }

    public static string UniquePath(string folder, string baseName, string ext)
    {
        string path = Path.Combine(folder, baseName + ext);
        for (int i = 2; File.Exists(path); i++) path = Path.Combine(folder, $"{baseName}_{i}{ext}");
        return path;
    }

    public static BitmapSource Load(string path)
    {
        using var fs = File.OpenRead(path);
        var decoder = BitmapDecoder.Create(fs, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
        BitmapSource frame = decoder.Frames[0];
        frame.Freeze();
        return frame;
    }
}
