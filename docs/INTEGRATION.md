# 分支整合与发布记录

最新状态（2026-10-15）：11 个新开发分支已合并，恢复 SHA 见末尾的“2026-10-15 新项目分支整合”；下方较早轮次的记录保留。

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


## 2026-10-14 后续成果整合

刷新远端后的基线为 `35a5afc2524a4162e28a9cd9de3b9e1d32f61a0a`，共 6 个远端分支，无开放 PR。新分支有 24 个独有提交；两个旧分支此前已完整并入 main。仓库可见性、Pages 的 `main:/docs` 来源与安全设置保持不变。

| 分支 | 合并或恢复 tip SHA | 本轮成果 |
| --- | --- | --- |
| `claude/awesome-meitner-yckpzc` | `c57d02c4404fe25d2ee9a88b8b12b27527dc537d` | Myriad，此前已合并 |
| `claude/peaceful-gauss-vfsup7` | `ae2122a47767f46daf1f9a530b2a5e9bed50182f` | Mojing，此前已合并 |
| `claude/cool-gauss-dhw8cz` | `9bd24a7cdddd4eb907823b760e4fa4d6dacc7ea9` | Tensora：10 页纯模拟控制台 |
| `claude/gallant-ritchie-s846wt` | `cd770260b27c8b287f57b0947743e17d528897ec` | Emberstack：卡牌策略、本地自主 AI、28 关与额外模式 |
| `claude/dreamy-dijkstra-8te314` | `8fe675d8b1813e3feeed09a5d3613310f1da6131` | Echowild：HDR 渲染、村落交易、旅程、生存与创造模式 |

保留原历史的三个合并提交：

- `1bc54788c652ee2b47644cce595921ae914c10ae` — Tensora。
- `275e10b319e030b9851816edf9f723328b9dec19` — Emberstack，导航与构建配置采用项目并集。
- `0d74c5d9c25928e06134f11f87b8e89bb1483506` — Echowild，保留新加载页与纯文本世界名称处理、小屏菜单适配。

公开导航包含 5 个浏览器交互项目、1 个产品界面原型、6 套数学模板、2 部影片及 1 个仅本地运行的桌面源码项目。Tensora 的密钥、训练、GPU、充值、邀请与统计全部为模拟，不连接后台；页面常驻演示说明，文件导入仅使用名称与大小，不上传、不读取内容，也不做实际去重或隐私扫描。Emberstack 的 AI 在浏览器内执行规则、规划与战术，没有外部模型调用。两项目的在线字体来自 Google Fonts，离线使用系统字体回退。

新分支新增内容经源码与历史启发扫描未发现真实凭据、意外私人文件或安装包；最终 662 个追踪文本文件的高置信 token/私钥形状扫描无命中。此检查不构成对所有历史和二进制的完整安全鉴定。Hongyan 的隔离边界保持不变，未运行历史安装包。没有访问或修改 MIT/GTM 工程。

本轮修复：Tensora 的实时曲线在重复横坐标采样时可能产生 NaN SVG；采样时间现保持单调，平滑曲线支持垂直退化段，并增加重复横坐标和倒退时钟回归测试。手机数据集预览抽屉的网格最小宽度也已修复，关闭按钮保持在屏内，并加入可关闭与正文边界回归检查。CSS 相对链接检查改为完整消费带引号的 SVG data URI，仍检查普通相对路径，避免将 SVG 内部 `url(%23n)` 误识别为外部资源。

删除候选仅限上表完整 tip 已可从发布后的 main 到达、部署验证通过、远端 tip 未变化且无开放 PR/新写入迹象的分支；若检查不通过即保留。恢复可使用本记录前述 `git branch recovered-project <tip SHA>` 方法。


本轮最终发布前验证：

- 单元测试共 158/158：MathScape 50、Myriad 26、交互实验室 14、Echowild 47、Emberstack 19、Tensora 2。
- 新项目浏览器测试：Tensora 源码 13/13、单文件 13/13（含手机抽屉）；Emberstack 各 7/7；Echowild 各 9/9。使用系统 Chromium；Echowild 使用软件 WebGL，结果不代表真实显卡性能。
- Emberstack 的 28 关 balanced 策略、单种子快速 AI 验证全部获胜，不代表所有策略与种子均已覆盖。
- 发布目录独立浏览器检查 16/16：九个在线入口、390px 导航、Tensora 十路由/演示导入/抽屉边界、Emberstack 真实触摸拖牌与观战、Echowild 手机菜单、两影片媒体就绪。字体回退检查使用空 CSS 响应模拟 Google Fonts 不可用。
- 整站构建成功；静态白名单 137 个文件、319 个相对引用通过。MathScape、Myriad、交互实验室、Mojing 与影片原发布文件没有内容变更。
- Tensora 首次浏览器测试发现两个 NaN SVG 错误，修复并复测全部通过；手机抽屉溢出也在视觉审查发现后修复。没有忽略这些错误或降低原断言。初次依赖安装因默认 npm 缓存目录不可写失败，改用可写临时缓存后成功，没有修改系统目录权限。

公共网址与提交对应的部署结果在推送后核验；仅在成功核验后进行分支清理。


本轮部署与清理结果：

- 发布提交：`54de81f509839bb9263f91d55177990d98e0a6dc`；[Pages Actions 38498954969](https://github.com/xhc144/claude-lab/actions/runs/38498954969) 的 build/report/deploy 全部成功。Pages build API 返回该提交 `built`、错误为空。
- 正常 TLS 校验下，主页与九个主要在线入口全部 HTTP 200；134 个公开静态文件 SHA-256 与本地受测产物完全一致。两部影片首尾各 4096 字节的 Range 请求均为 206 且内容匹配。
- 直接公共 Chromium 仍受本执行环境的 `ERR_CERT_AUTHORITY_INVALID` 限制，在网页脚本加载前失败；未忽略证书错误或修改信任库、安全配置。浏览器交互结果来自本地发布目录和源码/单文件测试，公开交互可信依据为线上产物与这些受测产物逐字节一致，不能写成直接公共浏览器交互通过。
- 已删除上表全部五个 Claude 分支，远端数量 **6 → 1**，只保留 `main`。删除前逐个重新读取 tip 与开放 PR，确认无新写入迹象、无开放 PR，完整原 tip 可从已部署 main 到达；普通删除还通过临时 pre-push 检查 Git 服务器广播 tip 是否与恢复 SHA 相同。每次删除后再次读取，确认分支不存在。
- 没有强推、永久清除对象、修改 Pages 来源或仓库可见性/安全设置。上表五个恢复 SHA 全部继续保留于 main 历史。

本记录的后续提交仅补充验证和恢复说明，发布项目文件与上述受测产物保持一致。

## 2026-10-15 新项目分支整合

基线为 `c649733`（当时的 `main`）。11 个远端分支均以 `--no-ff` 合并提交并入，原历史完整保留；只有根 `README.md` 冲突，合并后按栏目重新整理。各项目目录互不重叠，Pages 白名单与 `docs/` 发布内容不变。

| 分支 | 原 tip | 独有提交 | 内容 |
| --- | --- | ---: | --- |
| `claude/admiring-darwin-n77vx0` | `46b33903ec8a3a8caf6412afbe98f7cb878f452e` | 16 | motif/（律影 Windows 创作软件） |
| `claude/affectionate-wozniak-q0zygl` | `598e6687375115b091061726288af59a16bb0008` | 2 | .claude/skills/（六个数学技能） |
| `claude/wonderful-bardeen-4iwz6c` | `e8bae964e337cb56b0514fce3a629a33f880d87d` | 1 | .claude/skills/（与上一行树完全相同，冗余） |
| `claude/busy-feynman-qk5zjq` | `43b9d8cdd65aeb98a33f48b1cce596d7487b2a91` | 5 | windmill-theorem/（费马风车影片） |
| `claude/magical-pasteur-r7n64d` | `36fb2b16cf5b8ba35b23a1c53322d764c28ac478` | 7 | fermat-windmill/（风车里的素数） |
| `claude/gifted-hypatia-yeum34` | `29abc4892b48ef2049de5df43c13dfddd8a1a0f8` | 5 | particle-universe/（音乐粒子宇宙） |
| `claude/keen-dijkstra-pq6orc` | `d3e4bd73ca398fb3335283bded6a0c5e162b1aee` | 2 | lunheng/（论衡研究实验室） |
| `claude/kind-lovelace-ujf2cs` | `4e1e15ecb3151d0032bbcfdec17832adfce1d7cb` | 6 | phonica/（声准发音评测） |
| `claude/peaceful-thompson-1eau5t` | `4f2a7c7d85da5bb7ebe2131932626bfa57131e75` | 1 | fixed-point-film/（不动点影片） |
| `claude/tender-franklin-ibm8hg` | `721b76eba9e2a17da35ffd6f1d06fcf5c9507e4c` | 5 | optimization-film/、video-scripts/（最优化） |
| `claude/tender-lovelace-1pl4ki` | `e6971e64de2dfa0d4c97baf9b414084e7ee48f25` | 2 | two-sample-test-video/（双样本检验） |

验证：`node scripts/check-pages.mjs` 通过（137 个白名单文件、319 个相对引用）。新增的 6 部影片 MP4 均小于 GitHub 单文件 100 MB 上限，只放在各项目 `output/`，未复制到 Pages。


### 整合工作分支的恢复记录

`claude/nifty-cori-rk2hop` 与整理后的 main 指向同一提交，没有独有代码；清理远端引用前补齐完整恢复 SHA。此处仅补充记录，项目内容与原合并历史保持不变。

| 分支 | 原 tip / 恢复 SHA | 处理依据 |
| --- | --- | --- |
| `claude/nifty-cori-rk2hop` | `f02b2ca9bd0c2510f0ec9e40a93856fd9cb58776` | 与整合完成时的 main 相同，全部历史已保留 |

## 2026-10-15 站点改版与项目补全

- 主页改为由 `site/projects.mjs` 生成（`scripts/build-site.mjs`），收录仓库全部 21 个项目，分五类：浏览器交互、AI 与产品原型、桌面软件、影片、写作与工具。新收录：论衡、律影 Motif、音乐粒子宇宙、声准 Phonica、五部数学讲解影片、视频讲解稿、Claude 数学技能。
- 新增关键词搜索（`/` 或 Ctrl/⌘+K 聚焦，结果写入 `?q=&c=`）、分类筛选、深浅色主题、项目封面（`site/covers/`，约 620 KB）与移动端布局；墨经页面换用同一套页头、主题与页脚。
- 影片播放器从 2 个扩展为 7 个，双语影片可切换版本，带章节的影片可点击跳转，提供 MP4、SRT 与讲稿下载。发布的成片与各项目 `output/` 中的文件逐字节相同，Git 复用同一 blob，仓库体积不增加；Pages 发布目录约 600 MB，低于 1 GB 上限。
- `check-pages.mjs` 新增影片目录白名单：`films/<id>/` 下只允许 `index.html`、`film[-xx].mp4|srt`、`transcript.html|pdf`；MP4 与 SRT 不得出现在其他目录。
- 桌面软件只提供介绍与链接：Phonica 指向 Releases，Motif 与 Particle Universe 指向各自的 Windows 构建工作流；鸿雁邮箱仍只链接源码与隔离说明，不发布任何截图或安装包。
