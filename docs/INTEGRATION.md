# 分支整合与发布记录

基线：`43f38cdac1dd649fcc6a04505ffd435590789976`。默认分支 `main`，仓库公开属性保持不变。整合前 8 个远端分支，目标保留 `main` 一个。

## 原分支与恢复 SHA

删除前必须确认原 tip 是远端 main 的祖先；下列 tip 可恢复完整原分支。没有强推或永久清除对象。

| 原分支 | 原 tip | 基线独有提交 | 处理 |
| --- | --- | ---: | --- |
| `claude/awesome-meitner-yckpzc` | `5b34d1e63475ffdcd100d7af0a4b3e3dab0217fc` | 5 | 独立项目合并；原历史保留 |
| `claude/compassionate-einstein-l9kg5y` | `53c69d7aabf02f4cd1cb00ae703bc6222883b235` | 3 | 保留交互代码，公开内容脱敏，重新构建 |
| `claude/dazzling-hawking-m60xa2` | `4a87a93a76bfd8af524bb6f3d13769485d8d1d6e` | 0 | 已在基线历史中，冗余 |
| `claude/dreamy-dijkstra-8te314` | `fc99a077349c510ab73cfc828749585791323905` | 5 | 独立项目合并；原历史保留 |
| `claude/ecstatic-thompson-5wwaij` | `4296a3ff41e7a24739c6251a7935ada78582dfd6` | 2 | 保留源码，EXE 仅留历史、当前树隔离 |
| `claude/gracious-einstein-wob6zz` | `37f1563a549485e10f8e50ecc0a625bf45ab129e` | 4 | 映射 sea_above → sea-above，保留修复与成片 |
| `claude/nice-ramanujan-u1o7yk` | `a4d76175a4192b429fa91b9e6b79eb13cc8222dc` | 0 | 已在基线历史中，冗余 |

恢复方法（只在需要时执行；安装包历史恢复不代表安全）：

```sh
git fetch origin main
git branch recovered-project <原 tip SHA>
git push origin recovered-project
```

## 发布边界

- Pages 准备从 `main:/docs` 发布，产物由白名单构建脚本生成。
- 4 个浏览器项目；2 个影片播放器。Python 渲染工程仅通过 GitHub 源码链接访问。
- 鸿雁邮箱源码仅留仓库，不复制 Pages；历史安装包未执行、未发布，风险未鉴定。
- 交互实验室清除个人学段、目标、联系方式、私有项目与其他仓库内容；通用示意数据已标注。
- 没有修改 mit-ocw-notes，没有改变可见性或安全设置。

## 验证

本地发布目录浏览器检查 9/9 项通过：导航六个在线入口、390px 导航与交互实验室、MathScape 四模块、Myriad 开局与时间演化、13 台仪器及终端、Echowild 创建世界/Worker/WebGL、两部影片元数据与实际播放。

单元测试：MathScape 50/50、Myriad 26/26、交互实验室 14/14。

浏览器端到端用系统 Chromium 与软件 WebGL 验证：MathScape 32 个场景（首次31通过、修正动态渲染等待后失败场景重跑通过）；Myriad 11 个场景（首次9通过、两个固定等待场景改状态轮询后重跑2通过）；交互实验室 9/9。Myriad 断言保留原先时间推进与抬升越过海平面的条件，只等待实际状态达成。

环境策略阻止 `file://` 导航，因此交互实验室测试通过新 `PERSONAL_SITE_APP` 参数改走允许的本地 HTTP 发布目录；没有修改浏览器安全策略。离线双击模式未在本环境实测。原数学双星测试使用固定瞬时距离，平台浮点差异导致失败；改用物理上对应双星的负束缚能量检查，能量守恒及逃逸断言保留。MathScape 画面测试改等待实际渲染，避免固定延时和动态取样重复断言。

静态检查：102 个白名单文件，254 个相对引用存在；本地主要流程的404和JavaScript异常为零。主树 408 个已追踪文本经高置信密钥模式扫描无命中；这是启发扫描，不是对历史/二进制的完整安全鉴定。

主分支已成功推送发布准备提交 `0161ad18f02e2e0cad10325e6a2516de165dafcc`。

启用 Pages 请求：`POST /repos/xhc144/claude-lab/pages`，参数 `build_type=legacy`、`source.branch=main`、`source.path=/docs`。GitHub 返回 **403 Resource not accessible by integration**；随后 Pages API 404、仓库 `has_pages=false`。预定网址 `https://xhc144.github.io/claude-lab/` 实测 HTTP 404，尚无部署成功或公共交互验证。

GitHub 官方接口要求 Pages 写权限及 Administration 写权限；本次没有更改安全设置或寻找绕过方式。可由仓库管理员在 Settings → Pages 选择 Deploy from a branch / main / docs，或补足集成权限后继续。

按任务要求先部署验证再清理分支，当前暂缓删除：**8 → 8**，七个 Claude 分支原 tip 均已验证是远端 main 的祖先，恢复 SHA 已记录。Pages 启用、公共验证通过后即可重新核对 tip 并清理。

参考：[GitHub Pages API 权限](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site)、[配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 合并提交

- `2af4fbaba890f755c9742e533f823fe4a8adce5a` — Merge Hongyan source and isolate unverified Windows installer
- `ba42167d727ca111ef0f60a1f3ffa6fa09b5d125` — Merge interactive site with public-only demonstration content
- `7a3cfdefcfa449a04193d18851a193e9a32c741d` — Merge sea film revisions and finished video into sea-above
- `f121de1cb9e3ef4287b119ce45a1faec9ce86f7e` — Merge claude/dreamy-dijkstra-8te314 preserving standalone project
- `565050b9bbe50c0d3e76ebbab4b2ceba9854d8fd` — Merge claude/awesome-meitner-yckpzc preserving standalone project
