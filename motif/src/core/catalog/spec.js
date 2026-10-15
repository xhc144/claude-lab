// Tiny param-spec DSL shared by the component catalog, validation, docs and editor forms.

export const P = {
  str: (desc, extra = {}) => ({ type: 'string', desc, ...extra }),
  rich: (desc, extra = {}) => ({ type: 'richtext', desc, ...extra }),
  num: (desc, extra = {}) => ({ type: 'number', desc, ...extra }),
  int: (desc, extra = {}) => ({ type: 'integer', desc, ...extra }),
  bool: (desc, def, extra = {}) => ({ type: 'boolean', desc, default: def, ...extra }),
  enm: (values, def, desc, extra = {}) => ({ type: 'enum', values, default: def, desc, ...extra }),
  color: (desc, extra = {}) => ({ type: 'color', desc, ...extra }),
  icon: (desc, extra = {}) => ({ type: 'icon', desc, ...extra }),
  asset: (desc, extra = {}) => ({ type: 'asset', desc, ...extra }),
  expr: (desc, extra = {}) => ({ type: 'expr', desc, ...extra }),
  latex: (desc, extra = {}) => ({ type: 'latex', desc, ...extra }),
  data: (desc, extra = {}) => ({ type: 'data', desc, ...extra }),
  arr: (item, desc, extra = {}) => ({ type: 'array', item, desc, ...extra }),
  obj: (fields, desc, extra = {}) => ({ type: 'object', fields, desc, ...extra }),
  any: (desc, extra = {}) => ({ type: 'any', desc, ...extra }),
  range: (desc, extra = {}) => ({ type: 'range', desc, ...extra }),
};

/** Parameters every block accepts, regardless of type. */
export const COMMON_BLOCK_PARAMS = {
  id: P.str('稳定的块 ID（自动生成）。用于操作与动画覆盖。'),
  slot: P.enm(['auto', 'main', 'media', 'aside', 'header', 'footer'], 'auto', '放入布局的哪个区域。auto 时按块类型自动分配（文字→main，视觉→media）。'),
  frame: P.obj({ x: P.num('左边距，占画面宽度比例 0–1'), y: P.num('上边距比例 0–1'), w: P.num('宽度比例'), h: P.num('高度比例') }, '手动定位（覆盖自动布局）。人在编辑器里拖动元素时写入。'),
  motion: P.obj({
    enter: P.str('入场动画预设，auto=由主题决定。可选见 motions 目录。'),
    delay: P.num('相对自动编排的额外延迟（秒，可为负）'),
    at: P.num('在场景内的绝对开始时间（秒），覆盖自动编排'),
    speed: P.num('动画速度倍率，1 为主题默认'),
    emphasis: P.enm(['none', 'pulse', 'glow', 'shake', 'float'], 'none', '建成后的强调动画'),
    exit: P.enm(['auto', 'none', 'fade', 'reverse'], 'auto', '场景结束前的退场'),
  }, '动画覆盖。通常留空，交给主题的动画语言。'),
  style: P.obj({
    color: P.color('主色覆盖（可写主题色名 accent/accent2/ink/muted… 或 #hex）'),
    scale: P.num('尺寸倍率（0.5–2）'),
    align: P.enm(['auto', 'left', 'center', 'right'], 'auto', '对齐'),
    card: P.enm(['auto', 'none', 'card'], 'auto', '是否放在卡片里'),
  }, '局部样式覆盖。'),
  key: P.str('变形（morph）键：相邻场景中 key 相同的块会在 morph 转场中平滑过渡。'),
  hidden: P.bool('隐藏该块', false),
  locked: P.bool('在编辑器中锁定', false),
};

export const NATURES = ['headline', 'copy', 'visual'];
