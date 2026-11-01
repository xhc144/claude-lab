import type { GuidePageProps } from "./types";

export function ClientGuide({config}: GuidePageProps) {
  return <article className="help-article">
    <h1>怎样连接 Chatbox、Cherry Studio 或脚本？</h1>
    <p className="lead">在客户端中选择“OpenAI Compatible”或“OpenAI 兼容接口”，然后填写下面三项。</p>
    <table className="help-config-table"><tbody>
      <tr><th>Base URL</th><td><code>{config.url}</code></td></tr>
      <tr><th>API Key</th><td>在本应用“密钥管理”中生成的网关密钥</td></tr>
      <tr><th>Model</th><td><code>{config.model}</code></td></tr>
    </tbody></table>
    <div className="help-callout"><b>常见错误</b><p>Base URL 已经包含 <code>/v1</code>，不要再重复添加；客户端不能填写上游 API Key。</p></div>
  </article>;
}
