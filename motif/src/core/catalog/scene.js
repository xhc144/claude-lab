// Scene-level catalog: layouts, transitions, backgrounds, motion presets, camera moves, formats.

export const LAYOUTS = {
  auto: { label: '自动', description: '根据块的组合自动选择版式（推荐）。' },
  cover: { label: '封面', description: '大标题 + 副标题，开场或结尾。可放一个视觉块作背景或侧图（3D 主视觉、图片）。' },
  section: { label: '章节页', description: '章节编号 + 标题，用于段落之间的节奏停顿。' },
  split: { label: '左右分栏', description: '一侧文字（标题/要点），一侧视觉（图表/图片/3D）。variant.flip 交换左右。竖屏自动变为上下。' },
  focus: { label: '视觉聚焦', description: '小标题在上，视觉块占据大部分画面。适合重点图表、公式、3D。' },
  stack: { label: '上下堆叠', description: '标题在上，内容全宽依次排列。适合要点、表格、时间线。' },
  grid: { label: '网格', description: '标题 + 多个同类块等分网格（多个数字、多张图）。' },
  full: { label: '全屏', description: '视觉块铺满画面（图片/3D/模拟），标题叠加在角落，自动加暗化以保证可读。' },
  quote: { label: '引言', description: '居中大号引言。' },
  closing: { label: '结尾', description: '致谢/行动号召 + 联系方式。' },
  free: { label: '自由', description: '所有块按 frame 手动定位（编辑器中拖拽）。' },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

export const TRANSITIONS = {
  auto: { label: '自动', description: '由主题与内容关系决定（同章节柔和、跨章节更强）。' },
  cut: { label: '硬切', description: '直接切换。' },
  fade: { label: '交叉溶解', description: '两场景交叉淡化。' },
  dip: { label: '黑场/色场', description: '先淡入纯色（color，默认背景色）再淡出。' },
  push: { label: '推移', description: '新场景把旧场景推出画面。direction: left/right/up/down。' },
  slide: { label: '覆盖滑入', description: '新场景从一侧滑入覆盖旧场景，旧场景轻微后退变暗。' },
  wipe: { label: '擦除', description: '柔边擦除。direction 指定方向。' },
  band: { label: '色带扫过', description: '一条主题强调色带扫过画面完成切换（动态设计常用）。' },
  stripes: { label: '条纹', description: '多条彩色条纹依次扫过。' },
  iris: { label: '圆形展开', description: '圆形从中心（或 origin）展开新场景。' },
  zoom: { label: '穿梭缩放', description: '旧场景放大淡出，新场景从稍小处浮现。' },
  blur: { label: '失焦', description: '旧场景失焦淡出，新场景由模糊变清晰。' },
  scan: { label: '扫描', description: '一条亮线扫过并揭示新场景（科技/蓝图风格）。' },
  ink: { label: '墨晕', description: '以噪声纹理溶解，如墨在宣纸上晕开（水墨风格）。' },
  morph: { label: '变形', description: 'key 相同的块在两场景间平滑变形（位置、尺寸、颜色），其余内容交叉溶解。' },
};
export const TRANSITION_IDS = Object.keys(TRANSITIONS);

export const BACKGROUNDS = {
  auto: { label: '主题默认', description: '使用主题背景。' },
  solid: { label: '纯色', params: { color: '颜色' } },
  gradient: { label: '渐变', params: { colors: '颜色数组', angle: '角度' } },
  aurora: { label: '极光辉光', params: { colors: '光斑颜色', intensity: '强度 0–1' } },
  paper: { label: '纸张', params: { grain: '颗粒', fibers: '纤维' } },
  grid: { label: '网格线', params: { columns: '列数' } },
  blueprint: { label: '蓝图网格', params: {} },
  vignette: { label: '暗角', params: {} },
  ink: { label: '水墨', params: { mountains: '远山浓度' } },
  pop: { label: '波普几何', params: {} },
  soft: { label: '柔和渐变', params: {} },
  noir: { label: '电影暗场', params: {} },
  blobs: { label: '有机色块', params: { colors: '颜色' } },
  image: { label: '图片', params: { asset: '图片资源', overlay: '暗化 0–1', blur: '模糊 px' } },
};
export const BACKGROUND_IDS = Object.keys(BACKGROUNDS);

export const MOTIONS = {
  auto: '由主题决定',
  none: '无动画（直接出现）',
  fade: '淡入',
  rise: '上浮淡入',
  'rise-blur': '上浮 + 去模糊',
  drop: '下落淡入',
  'slide-left': '自右向左滑入',
  'slide-right': '自左向右滑入',
  'mask-up': '遮罩内上移揭示（逐行）',
  'mask-left': '遮罩内横移揭示',
  wipe: '柔边擦除',
  scale: '缩放淡入',
  pop: '弹性弹出',
  'pop-soft': '柔和弹出',
  slam: '放大砸入（带回弹）',
  focus: '失焦到清晰（电影感）',
  blur: '去模糊',
  type: '打字机',
  write: '书写（逐字淡入 + 微模糊）',
  ink: '墨晕显现',
  brush: '笔刷扫出',
  draw: '描线绘制（图形/图标）',
};
export const MOTION_IDS = Object.keys(MOTIONS);

export const CAMERAS = {
  auto: '主题默认',
  none: '固定',
  drift: '缓慢漂移（视差）',
  push: '缓慢推近',
  pull: '缓慢拉远',
  pan: '横向平移',
};

export const TONES = { auto: '自动（导演决定）', base: '主题基础色', inverse: '反色', accent: '强调色场' };

export const FORMATS = {
  '16:9': { width: 1920, height: 1080, label: '横屏 16:9（视频/演示）' },
  '9:16': { width: 1080, height: 1920, label: '竖屏 9:16（短视频）' },
  '1:1': { width: 1080, height: 1080, label: '方形 1:1（社交）' },
  '4:5': { width: 1080, height: 1350, label: '竖版 4:5（信息流）' },
  '4:3': { width: 1440, height: 1080, label: '传统 4:3' },
  '21:9': { width: 2520, height: 1080, label: '超宽 21:9（电影）' },
};

export function formatFromAspect(aspect) {
  if (!aspect) return null;
  const k = String(aspect).replace(/[x×/]/g, ':').replace(/\s/g, '');
  if (FORMATS[k]) return { ...FORMATS[k], aspect: k };
  const alias = { landscape: '16:9', horizontal: '16:9', wide: '16:9', portrait: '9:16', vertical: '9:16', story: '9:16', reels: '9:16', square: '1:1' }[k.toLowerCase()];
  return alias ? { ...FORMATS[alias], aspect: alias } : null;
}
