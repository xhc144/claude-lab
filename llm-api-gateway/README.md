# 大模型统一 API 网关

Windows 本地桌面网关，将多个大模型上游服务整理为统一的 OpenAI 兼容接口。

## 功能

- 管理上游渠道、API 地址和模型。
- 将不同上游模型映射为稳定的统一模型名称。
- 为客户端生成独立网关密钥，避免暴露上游 API Key。
- 提供 `/v1/models` 和 `/v1/chat/completions` 接口。
- 查看路由、Token、耗时、状态和错误元数据。
- 内置 DeepSeek、Kimi、OpenAI、通义千问、智谱和 NewAPI / One-API 渠道模板；选择后自动填写名称、服务商、Base URL 和常用模型。
- 渠道表单明确标注必填项，并在前端与后端同时校验。
- 从渠道的 `/api/pricing` 或 `/api/ratio_config` 自动同步模型价格。
- 内置 DeepSeek、Kimi 官方参考价，展示缓存命中、普通输入、输出和其他收费项目。
- 按实际输入、缓存命中和输出 Token 估算费用，并提供 Token 与费用折线图。
- 内置多页面中文帮助中心，按主题解释 API、Token、缓存、价格、渠道和客户端配置。

默认监听地址为 `http://127.0.0.1:8787/v1`。

## 开发

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run tauri dev
```

## 测试

```powershell
npm.cmd run build
cargo test --manifest-path src-tauri\Cargo.toml
```

## Windows 安装包

```powershell
npm.cmd run tauri build
```

NSIS 安装包生成在 `src-tauri\target\release\bundle\nsis`。

## 数据与安全

- 数据库：`%APPDATA%\LocalModelGateway\gateway.db`
- 上游 API Key：Windows 凭据管理器
- 调用记录不保存提示词、代码正文或模型回复

备份数据库前请先停止网关。仅复制数据库不会迁移 Windows 凭据管理器中的上游密钥。
