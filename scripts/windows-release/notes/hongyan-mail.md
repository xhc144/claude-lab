**鸿雁邮箱 Hongyan Mail {{VERSION}}** — 本地运行的 Windows 多账户邮件客户端（64 位安装包，已签名）。

这个安装包由 GitHub Actions 从本仓库源码重新构建、测试并签名，与早先被隔离的历史安装包无关（见 [隔离记录](https://github.com/{{REPO}}/blob/main/hongyan-mail/QUARANTINE.md)）。下载 `HongyanMail-Setup-{{VERSION}}.exe` 并运行即可安装（无需管理员权限）；已经装好的鸿雁邮箱会自己下载并安装新版本。

源码审查的已知限制仍然有效（OAuth `clientSecret` 等本地存储方式，详见项目 README），处理重要账号前请先阅读。

{{CHANGES}}

源码：{{SOURCE}}

SHA-256：
```
{{SHA256}}
```
