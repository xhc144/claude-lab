export function ModelsGuide() {
  return <article className="help-article">
    <h1>什么是模型映射？</h1>
    <p className="lead">模型映射相当于给供应商的真实模型起一个稳定的本地名字。以后更换渠道，客户端仍然可以使用原来的统一名称。</p>
    <p>渠道保存时会自动增加 <code>xhc-</code> 前缀，例如 <code>xhc-kimi-k3 → kimi-k3</code>。左边是客户端填写的名称，右边是网关真正发给供应商的模型 ID。</p>
    <div className="mapping-example"><code>客户端：xhc-deepseek-v4-flash</code><i>→</i><code>网关映射</code><i>→</i><code>供应商：deepseek-v4-flash</code></div>
    <dl className="term-list">
      <dt>统一模型名称</dt><dd>客户端看到并填写的名称。本应用统一使用 <code>xhc-</code> 前缀。</dd>
      <dt>供应商实际模型</dt><dd>DeepSeek、Kimi 或中转站要求的真实模型 ID。“上游”原来就是指这些实际提供模型服务的网站。</dd>
      <dt>模型渠道顺序</dt><dd>每个模型可以独立勾选多个渠道并排序。第 1 个是首选，失败后按第 2、3、4…个依次切换；未勾选的渠道不会用于这个模型。</dd>
      <dt>价格</dt><dd>选择已内置参考价的模型时，价格为 0 保存会自动匹配；也可以手动填写或从渠道同步。</dd>
    </dl>
  </article>;
}
