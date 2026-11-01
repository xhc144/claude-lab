import type { GuidePageProps } from "./types";

export function StartGuide({config}: GuidePageProps) {
  return <article className="help-article">
    <h1>第一次使用：只要完成 4 步</h1>
    <p className="lead">这个网关像一个“AI 总机”：客户端只连接本机总机，总机再替你连接 DeepSeek、Kimi 或中转站。</p>
    <ol className="help-steps">
      <li><b>添加渠道</b><span>选择模板，让应用自动填写公开信息；你只需提供自己的上游 API Key。</span></li>
      <li><b>添加模型映射</b><span>把上游模型名称变成客户端容易记住的统一名称。</span></li>
      <li><b>生成网关密钥</b><span>客户端使用网关密钥，不直接接触上游 API Key。</span></li>
      <li><b>填写客户端</b><span>Base URL 填 <code>{config.url}</code>，模型填 <code>{config.model}</code>。</span></li>
    </ol>
    <div className="help-callout"><b>记住两种密钥</b><p>上游 API Key 用来连接供应商；网关密钥用来连接这台电脑。两者不能混用。</p></div>
  </article>;
}
