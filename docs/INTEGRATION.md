# 分支整合与发布记录

基线：`43f38cdac1dd649fcc6a04505ffd435590789976`。默认分支 `main`，仓库公开属性保持不变。整合前 8 个远端分支；清理后只保留 `main`，远端分支数量 **8 → 1**。

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

- Pages 从 `main:/docs` 发布，产物由白名单构建脚本生成。
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

用户在仓库设置中启用 Pages 后，已只读核验：`source.branch=main`、`source.path=/docs`、`build_type=legacy`、`public=true`、`status=built`。首次确认成功部署的 commit 是 `a215fdda9dd34229bad07c2c81e7bc3425d3f143`，构建于 `2026-10-13T05:44:54Z` 开始、`05:45:28Z` 完成，构建错误为空。

**公开入口：[https://xhc144.github.io/claude-lab/](https://xhc144.github.io/claude-lab/)**。

公共 HTTP 核验使用正常 TLS 证书校验：主页与六个主要入口均为 200；99 个页面、脚本、样式、字体等公开资源全部为 200，SHA-256 与先前通过交互测试的本地产物一致。两个影片均为 `video/mp4`、HTTP 200，大小分别为 94,941,117 和 83,561,613 字节；文件首尾的 Range 请求均为 206，字节与本地已播放的影片一致。

直接公共浏览器测试受本执行环境 Chromium 的 `ERR_CERT_AUTHORITY_INVALID` 限制，失败发生在网页脚本加载前；没有关闭证书校验、修改证书信任库或仓库安全设置。普通 HTTPS 客户端的证书验证成功。公开交互验证的证据是在线产物与此前 9 项主要流程、52 个浏览器场景通过的产物一致；不能把这些本地结果描述为本轮直接公共浏览器交互通过。

此前启用 Pages 的 API 请求曾返回 403，用户手动设置后部署成功；本轮只读取配置/构建状态和公开网页，没有再次创建 Pages 或更改权限。后续状态 API 读取出现 401，但此前 `built` 结果与实际公开资源的 200 返回已经确认上线。

2026-10-13 已清理七个完整整合或冗余的 Claude 分支，远端分支数量 **8 → 1**，只剩 `main`。分支清理是独立已授权事项，保留在主分支的项目历史可恢复。

每次删除前重新读取远端 tip，确认与上表恢复 SHA 相同，并确认原 tip 是远端 `main`（`bb940fbe978593cce426ed98e94c748372ed2440`）的祖先。普通 `git push --delete` 的临时检查钩子还核对 Git 服务器广播的 tip；若不一致则拒绝删除。七次删除均成功，逐项再次读取远端确认分支不存在，没有发现并发新提交。

未删除 `main`、未强推、未清除历史对象、未修改仓库可见性或安全权限。上表恢复 SHA 仍可从 `main` 到达。原分支清理没有再次尝试 Pages 写接口。

参考：[GitHub Pages API 权限](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site)、[配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 合并提交

- `2af4fbaba890f755c9742e533f823fe4a8adce5a` — Merge Hongyan source and isolate unverified Windows installer
- `ba42167d727ca111ef0f60a1f3ffa6fa09b5d125` — Merge interactive site with public-only demonstration content
- `7a3cfdefcfa449a04193d18851a193e9a32c741d` — Merge sea film revisions and finished video into sea-above
- `f121de1cb9e3ef4287b119ce45a1faec9ce86f7e` — Merge claude/dreamy-dijkstra-8te314 preserving standalone project
- `565050b9bbe50c0d3e76ebbab4b2ceba9854d8fd` — Merge claude/awesome-meitner-yckpzc preserving standalone project

## 后续分支

公开部署核验时发现新分支 `claude/peaceful-gauss-vfsup7`，tip 为 `ae2122a47767f46daf1f9a530b2a5e9bed50182f`。本轮范围是部署核验与状态文档更新，已保留此新开发分支，没有合并或删除。原七个分支的清理结果仍为 8 → 1；新分支出现后当前远端共 2 个分支。

## 三项后续更新同步

同步基线为 `ee699ee48ab91651a70dc7a846208061a968e9de`。合并前重新核对以下远端 tip，与此前只读盘点一致：

| 项目 | 分支 tip | 本轮内容 |
| --- | --- | --- |
| 万象 Myriad | `c57d02c4404fe25d2ee9a88b8b12b27527dc537d` | 精灵缓存、稳定侧栏、性能统计与重建的单文件 |
| 回响荒野 Echowild | `0953079813eae2bfb0df9ee7fb6db9315da3af73` | 电路/岛下光照更新、测试、截图、重新构建的离线单文件 |
| 墨经 Mojing | `ae2122a47767f46daf1f9a530b2a5e9bed50182f` | 六套独立模板、十份原 PDF、预览图与六个 ZIP，以及新展示页 |

旧根 README 冲突保留当前主分支导航；Echowild 保留世界名纯文本处理与小屏适配，随后重建单文件。Myriad 侧栏补充取消手势与窗口失焦时的释放处理，并加入可见内容继续更新的回归验证。本轮保留三条开发分支，不删除或强推，不更改 Pages 来源/权限。

新增页面为 `/mojing/`，六套模板的主 PDF 与学生版、答案版、双栏等变体共十份，全部有明确入口。六个 ZIP 的使用说明改名为 `README.txt`，归档成员名称全部 ASCII，避免原中文文件名编码标志不足导致解压乱码；各源码文件仍与模板原文件一致。原 PDF Git blob 保持不变，其他项目默认模板未改变。

发布继续采用明确白名单：`docs/echowild/echowild.html`、新游戏源码及重建 Myriad；墨经仅展示页、十个 PDF、九个 PNG、六个 ZIP。不会复制 TeX 构建脚本、运行数据、Hongyan 安装包或其他仓库资料到 Pages。

本轮验证：

- Myriad 单元 26/26，相关浏览器流程 6/6，含侧栏取消/失焦、各页签、存档及渲染。
- Echowild 单元 27/27，源码和单文件浏览器流程各 5/5，含建世界、采集制作、保存重载、地图图鉴及碎片主线。
- 发布目录主要流程 7/7，含墨经六个模板卡片、十份 PDF、六个 ZIP 与 390px 布局。
- 静态白名单 129 文件、288 相对引用通过；六个 ZIP 全部 CRC 通过、无路径穿越，模板 payload 与源码一致。
- 墨经十份 PDF 共104页已全部渲染并视觉审查，87条字体记录全部嵌入；无明显裁切或异常黑块。双面书籍的计划空页及试卷作答留白保留。
- 在临时副本重新编译模板时，本执行环境缺少 `ctex.sty`；这项源编译未通过。已有完整性与视觉核验的原 PDF 用于网页预览，下载包仍按 README 要求使用完整 TeX Live/XeLaTeX 环境。

提交对应的 Pages Actions 与公开资源核验作为部署证据；直接公共 Chromium 曾受执行环境证书信任限制，正常证书校验保持开启。

## 星枢 Tensora 加入站点

新增 `tensora/`：零依赖的 AI 基础设施控制台前端（API 网关、训练平台、GPU 集群与费用），数据全部为浏览器内模拟。发布只复制单文件构建 `tensora/dist/tensora.html` → `docs/tensora/index.html`，并在导航页新增「产品界面原型」入口；`scripts/build-pages.mjs` 已把 tensora 加入构建与白名单复制列表。

验证：源码版与单文件版 Playwright 各 12/12（桌面 11 个流程含命令面板、创建密钥、模型 Playground、训练向导、任务控制、集群抽屉与排空、充值与通知、路由切换关闭浮层；手机 390px 宽度十个页面无横向滚动及底部导航）；`node scripts/check-pages.mjs` 通过。
