# 回响荒野 · Echowild

纯浏览器 WebGL2 体素冒险游戏。世界、方块模型、光照、天气、动植物与音效由代码生成，包含建造、生存、制作、自动化、冒险与本地存档。

[在线游玩](https://xhc144.github.io/claude-lab/echowild/) · [项目导航](../README.md)

需要支持 WebGL2、ES modules、Worker 和 IndexedDB 的桌面浏览器。使用键盘与鼠标，点击画面锁定鼠标；暂不支持手机触屏操作。低性能设备可在设置中降低视距。存档在自己的浏览器内，清理数据前请在世界选择页面导出。

## 本地运行

```sh
cd echowild
node scripts/serve.mjs
```

按控制台显示的 HTTP 地址打开。没有生产构建步骤或运行时包依赖；发布时必须同时保留 `index.html`、`css/` 和 `src/` 的目录结构，Worker 使用相对模块地址。不能直接双击 `index.html` 作为可靠运行方式。

## 基本操作

- “开始冒险” → “新建世界”，填写种子并选择生存或创造模式。
- WASD 移动、空格跳跃，鼠标观察；按 Esc 释放鼠标/暂停。
- 玩法指南给出背包、制作、放置、保存等完整操作。
- 世界选择页提供存档导入与导出。

`package.json` 的 Playwright 是开发验证工具，浏览器运行不需要安装 npm 依赖。
