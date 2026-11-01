export function CacheGuide() {
  return <article className="help-article">
    <h1>“缓存命中”是什么意思？</h1>
    <p className="lead">缓存就是 AI 服务临时记住了你之前发过的相同开头。再次发送时，它可以直接复用，不必重新计算这一部分。</p>
    <div className="cache-example">
      <div><b>第一次提问</b><span>系统提示词 + 长文档 + 问题 A</span><em>通常按“缓存未命中输入”收费</em></div>
      <i>→</i>
      <div><b>第二次提问</b><span>同一系统提示词 + 同一长文档 + 问题 B</span><em>相同开头可能“命中缓存”</em></div>
    </div>
    <dl className="term-list">
      <dt>缓存命中 Token</dt><dd>供应商成功复用的输入部分，通常比普通输入便宜。</dd>
      <dt>缓存未命中 Token</dt><dd>没有复用、必须重新计算的输入部分，按普通输入价收费。</dd>
      <dt>缓存写入费</dt><dd>有些供应商在建立缓存时另外收费；DeepSeek 和当前 Kimi 官方价格没有单列这一项。</dd>
      <dt>缓存存储费</dt><dd>有些供应商按缓存保存的时间收费；没有官方报价时，本应用显示“—”，不会猜测。</dd>
    </dl>
    <div className="help-callout"><b>怎样更容易命中？</b><p>把固定的系统提示词、长文档和工具定义放在消息开头，并尽量保持完全相同；把每次变化的问题放在后面。</p></div>
  </article>;
}
