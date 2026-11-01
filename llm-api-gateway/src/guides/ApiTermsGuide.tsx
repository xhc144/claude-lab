import type { GuidePageProps } from "./types";

export function ApiTermsGuide({config}: GuidePageProps) {
  return <article className="help-article">
    <h1>API、Base URL、API Key 是什么？</h1>
    <p className="lead">可以把 API 想成餐厅的点餐窗口：你按照规定格式提交问题，窗口把问题交给 AI，再把回答交还给你。</p>
    <dl className="term-list">
      <dt>API</dt><dd>软件和软件之间沟通的规则。你不需要会编程，也可以在 Chatbox、Cherry Studio 等客户端里使用它。</dd>
      <dt>Base URL</dt><dd>服务地址，类似餐厅地址。客户端连接本应用时填写 <code>{config.url}</code>。</dd>
      <dt>API Key</dt><dd>访问钥匙，用来证明你有权使用服务。它通常是一串很长的字符，应当像密码一样保管。</dd>
      <dt>Model</dt><dd>具体要使用的 AI 型号，例如 <code>deepseek-v4-flash</code> 或 <code>kimi-k3</code>。</dd>
      <dt>请求 / 响应</dt><dd>客户端发出去的问题叫请求；AI 返回的结果叫响应。</dd>
    </dl>
  </article>;
}
