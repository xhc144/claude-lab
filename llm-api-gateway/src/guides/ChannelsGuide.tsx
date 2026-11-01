export function ChannelsGuide() {
  return <article className="help-article">
    <h1>渠道模板和优先级</h1>
    <p className="lead">渠道就是模型的实际供应商。选择 DeepSeek、Kimi 中国版或 Kimi 国际版模板后，名称、服务商、官方地址和常用模型会自动填写。</p>
    <dl className="term-list">
      <dt>必填项</dt><dd>渠道名称、服务商、Base URL 和 API Key。API Key 是私人信息，模板不能代替你获取。</dd>
      <dt>支持模型</dt><dd>这个渠道可以调用的模型列表，多个模型用英文逗号分隔。</dd>
      <dt>Kimi 版本</dt><dd>在 <code>platform.kimi.com</code> 申请的中国版 Key 使用 <code>api.moonshot.cn</code>；在 <code>platform.kimi.ai</code> 申请的国际版 Key 使用 <code>api.moonshot.ai</code>，两者不能混用。</dd>
      <dt>自动映射</dt><dd>保存渠道时默认把每个支持模型建立为 <code>xhc-模型名 → 供应商实际模型名</code>；已有渠道也可以点击“自动加映射”。</dd>
      <dt>优先级</dt><dd>首选渠道失败后，支持同一个实际模型的其他渠道会成为备用，数字较小的更早尝试。它不是质量分数。</dd>
      <dt>为什么有时显示“无备用”</dt><dd>只有另一条已启用渠道也支持同一个供应商实际模型，才能自动接替。需要在第二条渠道的“支持模型”中加入同名模型，或者在模型编辑窗口指定备用渠道。</dd>
      <dt>测试</dt><dd>保存后检查地址和 API Key 是否有效，不会生成聊天内容。</dd>
      <dt>查价格</dt><dd>中转站会尝试公开的 <code>/api/pricing</code> 和 <code>/api/ratio_config</code>。</dd>
    </dl>
  </article>;
}
