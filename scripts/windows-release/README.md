# Windows 软件：自动更新与免费签名

声准 Phonica、律影 Motif、音乐粒子宇宙这三个 Windows 软件的**安装版**会自动更新，用自签名证书盖章也不用花钱。这个文件夹里是共用的脚本。

## 自动更新是怎么工作的

1. 在 GitHub Actions 里手动运行某个软件的工作流，勾选 `release`。它会做两件事：
   - 把安装包发布到这个版本自己的发布页，比如 `phonica-v1.1.0`；
   - 更新一个固定的"更新信息"发布页，比如 `phonica-latest`，里面只有一个 `latest.yml`，写着最新版本号、安装包地址和校验码。
2. 装好的软件启动后不久去读这个 `latest.yml`，之后每 6 小时读一次。发现新版本就在后台下载，下载完核对校验码。
3. 下载好以后，软件会提示"重启更新"（Phonica 在标题栏，Motif 和粒子宇宙弹一个窗口）。不点的话，下次关闭软件时也会自动装上。

| 软件 | 更新信息地址 | 在哪看更新状态 |
| --- | --- | --- |
| 声准 Phonica | `releases/download/phonica-latest/latest.yml` | 设置 → 软件更新（可以关掉自动检查） |
| 律影 Motif | `releases/download/motif-latest/latest.yml` | 设置 → 关于 |
| 音乐粒子宇宙 | `releases/download/particle-universe-latest/latest.yml` | 下载好后弹窗提示 |

几点说明：

- **只有用安装包装的才会自动更新**。解压的便携版 zip 不更新，否则会在别处再装一份。
- `*-latest` 这几个发布页不要删，删了已安装的软件就找不到新版本了。
- 发新版本前要先把对应软件 `package.json` 里的 `version` 改大，比如 1.1.0 → 1.1.1。版本号没变，软件不会认为有更新。
- 出了问题，可以看软件数据目录下的 `logs\updater.log`（`%APPDATA%\<软件名>\logs\updater.log`）。
- 从旧版本（Phonica 1.0.0、Motif 0.9.0、粒子宇宙 1.0.0 便携版）升级，要手动装一次新安装包，之后就自动了。

## 免费签名：自己做一张证书

签名的作用：Windows 能显示"这是谁做的"，自动更新时软件也能确认新安装包确实是你发的，不是被人换掉的。

**限制**：自签名证书只在**装了这张证书的电脑上**被信任。别人的电脑不认它，第一次下载安装时还是会看到"未知发布者"之类的提示。

### 第一步：在你的 Windows 电脑上生成证书

把 `new-signing-cert.ps1` 下载到电脑上，在它所在的文件夹打开 PowerShell，运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\new-signing-cert.ps1
# 想让安装时显示别的名字：
powershell -ExecutionPolicy Bypass -File .\new-signing-cert.ps1 -Name "你的名字"
```

中间 Windows 会弹窗问是否安装这张证书，点"是"。完成后，桌面上会多一个"代码签名证书"文件夹。

### 第二步：把证书交给 GitHub

打开 <https://github.com/xhc144/claude-lab/settings/secrets/actions>，点 **New repository secret**，新建两个：

| 名字 | 内容 |
| --- | --- |
| `WIN_CSC_LINK` | `WIN_CSC_LINK.txt` 里的全部文字 |
| `WIN_CSC_KEY_PASSWORD` | `WIN_CSC_KEY_PASSWORD.txt` 里的文字 |

粘贴完删掉这两个 txt。`code-signing.pfx` 和密码另外备份（U 盘或密码管理器），**不要提交到仓库，不要发给别人**。谁拿到它，谁就能做出你的电脑会信任的软件。不过这张证书只能用来给软件盖章，不能用来冒充网站。

以后三个软件的工作流都会自动用它签名，构建日志里能看到签名人是 `CN=你的名字`。

### 第三步：别的电脑

想在另一台电脑上也信任它：把 `code-signing.cer`（不是 .pfx）和 `trust-signing-cert.ps1` 拷过去，运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\trust-signing-cert.ps1
```

## 签名以后要注意

- 签过名的版本只接受**同一个名字、并且这台电脑信任的证书**签的新版本。所以：
  - 在一台**没有信任这张证书**的电脑上，签名版能安装（会有提示），但**自动更新会被拒绝**。这时先在那台电脑上做第三步就好。
  - 证书丢了也不要紧：用**同一个名字**重新生成一张，把 GitHub 里的两个 secret 换掉，再在每台电脑上信任新证书即可。
- 没设置 secret 时，构建出来的是未签名版本，工作流会给一个黄色警告。未签名的版本也能正常自动更新（靠校验码确认文件完整），只是没法确认是谁发布的。

## 被杀毒软件报毒怎么办

签名不能保证不被报毒。如果 Windows Defender 把你自己的软件报成病毒，到微软的提交页面（搜"Microsoft Security Intelligence 提交文件"）上传那个文件，选"我认为这是误报"。免费，一般几天内有结果，确认误报后所有电脑都会跟着不报。

## 文件

| 文件 | 用途 |
| --- | --- |
| `new-signing-cert.ps1` | 生成自签名代码签名证书，并让本机信任它 |
| `trust-signing-cert.ps1` | 让另一台电脑信任这张证书（只需要 .cer） |
| `update-feed.mjs` | 工作流使用：把安装包旁边的 `latest.yml` 改成指向版本发布页的更新信息，并核对大小与校验码 |
