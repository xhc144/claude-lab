# 安装包隔离记录

- 原分支：`claude/ecstatic-thompson-5wwaij`
- 原 tip：`4296a3ff41e7a24739c6251a7935ada78582dfd6`
- 历史路径：`hongyan-mail/release/HongyanMail-Setup-1.0.0.exe`
- 大小：96,741,105 字节
- SHA-256：`9885f8ced5d123bc8bc1573bc26976f07d9a03e993c94473ea4ee59793d1acdb`
- 用户报告：Defender 检出 `Trojan:Win32/Sabsik.FL.A!ml`；真实性未确认。

本次只读取字节计算摘要，没有执行或加载安装包。当前主树移除安装包，Git 合并历史保留原对象；不强推、不清除历史对象。恢复历史需经过独立安全审查，默认不提供网页安装包下载。

保留的源代码、构建脚本、测试和虚构数据截图不进入 Pages 发布目录。源码只读审查不能证明历史 EXE 安全。

## 后续：从源码重新构建并签名（2026-10-16）

1.1.0 起不再使用分支里提交的安装包。安装包改由 `.github/workflows/hongyan-mail-windows.yml` 在 GitHub Actions 的 Windows 环境中从源码构建（electron-builder NSIS），经类型检查、单元测试、打包后启动测试与静默安装测试，用仓库证书签名后发布为 `hongyan-mail-v*`。上面记录的历史 EXE 仍然隔离，不提供下载，也不作为任何发布的来源。
