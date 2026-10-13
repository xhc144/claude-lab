# 《0 → ∞》交互实验室

从零维到无穷维的浏览器交互作品，包含复映射、线性变换、傅里叶、三叶结与曲面、双摆、量子波包、神经网络与注意力等 13 台仪器。WebGL 粒子场随章节变化，支持低画质和减少动画设置。

[在线访问](https://xhc144.github.io/claude-lab/personal-site/) · [返回项目目录](../README.md)

公开版本使用一般实验介绍与本仓库项目目录；没有个人学段、备考目标、联系方式、私有项目清单或其他仓库资料。星图、光柱与周期图案使用明确标注的示意权重，不表示出版或活动统计。原分支历史保持可恢复。

## 本地运行

需要 Node.js 18 或更新版本。以下命令在本目录执行：

```sh
npm ci
npm run build
npm start
```

打开 `http://127.0.0.1:5180`。`dist/` 可以部署到任意静态网站，资源路径均为相对路径；也可直接打开 `dist/index.html`。页面使用本地字体与打包的 three.js、KaTeX，不需要邮件服务或外部账号。

## 验证与构建

```sh
npm run test:unit
npm run test:e2e
npm run build
npm run zip
```

`src/` 是可编辑源码，`scripts/build.mjs` 使用 esbuild 生成 `dist/`。数学测试检验 FFT、纽结、双摆、表示与波包等计算。浏览器测试检验仪器、终端和导航。`release/xhc144-site.zip` 是重新生成的公开版本源码与静态文件包。
