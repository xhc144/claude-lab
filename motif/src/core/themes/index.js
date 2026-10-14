// Built-in design systems. A theme is pure data (design tokens); the engine turns it into
// pixels. Every token can be overridden per document via `theme.overrides` (deep merge).
//
// Token groups
//   palette   colors for the base tone; `data` is the categorical series palette
//   tones     scene-level variants (inverse / accent) used for rhythm (section breaks, big numbers)
//   fonts     typographic roles: display, heading, text, label, number, mono
//   type      size scale (px at a 1080 short side) – sizes adapt to aspect ratio automatically
//   shape     corner radius, stroke, card treatment
//   grid      margins & columns as fractions of the frame
//   background generator + params (see engine/backgrounds)
//   motion    the animation personality: easing, tempo, entrance vocabulary, camera, transitions
//   chart     data-visualisation styling
//   layout    compositional preferences (alignment, section style)

const SANS_SC = 'Motif Sans SC';
const SERIF_SC = 'Motif Serif SC';

export const THEMES = {
  aurora: {
    id: 'aurora',
    name: '极光 Aurora',
    description: '深色科技发布风格：极光辉光背景、玻璃卡片、柔和模糊入场与缓推镜头。适合产品发布、AI/科技、融资路演。',
    mood: ['tech', 'launch', 'dark', 'futuristic'],
    scheme: 'dark',
    palette: {
      bg: '#070815', bg2: '#0d1030', surface: 'rgba(255,255,255,0.055)', surface2: 'rgba(255,255,255,0.1)',
      ink: '#f4f6ff', muted: '#a6aed3', faint: '#666d96', line: 'rgba(190,200,255,0.16)',
      accent: '#5ee0ff', accent2: '#9b8cff', accent3: '#ff7ac6',
      positive: '#4ade9a', negative: '#ff6f8e', warning: '#ffc46b',
      highlight: 'rgba(94,224,255,0.18)', onAccent: '#07101f',
      data: ['#5ee0ff', '#9b8cff', '#ff7ac6', '#ffc46b', '#5cf2b0', '#6f9bff', '#ff8a7a', '#d6c2ff'],
      gradient: ['#5ee0ff', '#9b8cff', '#ff7ac6'],
    },
    tones: {
      inverse: { bg: '#e9ecff', bg2: '#dfe3ff', surface: 'rgba(10,14,40,0.05)', ink: '#0b0e26', muted: '#4b5280', faint: '#8a90b5', line: 'rgba(10,14,40,0.14)', accent: '#3b4dff' },
      accent: { bg: '#2a1f7a', bg2: '#3a2b9e', ink: '#ffffff', muted: '#cfc8ff', faint: '#8f86d9', line: 'rgba(255,255,255,0.22)', surface: 'rgba(255,255,255,0.08)', accent: '#5ee0ff' },
    },
    fonts: {
      display: { family: ['Motif Grotesk', SANS_SC], weight: 600, tracking: -0.028, lineHeight: 1.04 },
      heading: { family: ['Motif Grotesk', SANS_SC], weight: 600, tracking: -0.018, lineHeight: 1.12 },
      text: { family: ['Motif Inter', SANS_SC], weight: 400, tracking: -0.004, lineHeight: 1.5 },
      label: { family: ['Motif Mono', SANS_SC], weight: 500, tracking: 0.14, case: 'upper', lineHeight: 1.3 },
      number: { family: ['Motif Grotesk', SANS_SC], weight: 600, tracking: -0.035, lineHeight: 1 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 34, ratio: 1.36 },
    shape: { radius: 22, stroke: 1.5, card: 'glass' },
    grid: { marginX: 0.075, marginY: 0.1, columns: 12, gutter: 0.018 },
    background: { type: 'aurora', colors: ['#2f45ff', '#7c4dff', '#00b4d8', '#e0469b'], intensity: 0.6, stars: 0.5, grain: 0.035, persistent: true },
    decor: { kicker: 'pill', rule: false, glow: true },
    motion: {
      personality: 'smooth', ease: [0.16, 1, 0.3, 1], duration: 0.95, stagger: 0.085, unit: 'word',
      enter: 'rise-blur', titleEnter: 'rise-blur', distance: 0.45, blur: 12, overshoot: 0,
      camera: { type: 'drift', amount: 0.6 },
      transition: { type: 'zoom', duration: 0.95 }, sectionTransition: { type: 'blur', duration: 1.1 },
    },
    chart: { grid: 'dashed', barRadius: 8, lineWidth: 4, dot: 'glow', glow: true, area: 0.28 },
    layout: { coverAlign: 'center', titleAlign: 'left', section: 'number' },
  },

  editorial: {
    id: 'editorial',
    name: '报刊 Editorial',
    description: '暖纸色深度报道风格：衬线大标题、朱红强调、细线分栏、逐行遮罩揭示。适合年度报告、调研、故事化叙述。',
    mood: ['report', 'story', 'serious', 'light'],
    scheme: 'light',
    palette: {
      bg: '#f3eee5', bg2: '#ebe4d6', surface: '#faf7f1', surface2: '#efe8db',
      ink: '#1a1814', muted: '#5f584d', faint: '#9a9184', line: '#d3c9b8',
      accent: '#c23a22', accent2: '#1d4a73', accent3: '#c99a2e',
      positive: '#3f7a52', negative: '#c23a22', warning: '#c99a2e',
      highlight: 'rgba(201,154,46,0.28)', onAccent: '#fbf6ee',
      data: ['#c23a22', '#1d4a73', '#c99a2e', '#4c7a5a', '#7b4f8e', '#2b2823', '#d07a54', '#6c9ab8'],
      gradient: ['#c23a22', '#c99a2e'],
    },
    tones: {
      inverse: { bg: '#1b1915', bg2: '#24211c', surface: '#26231e', ink: '#f3eee5', muted: '#b5ab9b', faint: '#7a7266', line: '#3e3931', accent: '#e8664c' },
      accent: { bg: '#c23a22', bg2: '#b23219', surface: 'rgba(255,255,255,0.08)', ink: '#fbf6ee', muted: '#f3cfc4', faint: '#e09a88', line: 'rgba(255,255,255,0.3)', accent: '#ffe1a6' },
    },
    fonts: {
      display: { family: ['Motif Fraunces', SERIF_SC], weight: 560, tracking: -0.02, lineHeight: 1.06 },
      heading: { family: ['Motif Fraunces', SERIF_SC], weight: 600, tracking: -0.012, lineHeight: 1.15 },
      text: { family: ['Motif Fraunces', SERIF_SC], weight: 400, tracking: 0, lineHeight: 1.6 },
      label: { family: ['Motif Inter', SANS_SC], weight: 650, tracking: 0.16, case: 'upper', lineHeight: 1.3, color: 'accent' },
      number: { family: ['Motif Fraunces', SERIF_SC], weight: 600, tracking: -0.03, lineHeight: 1 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 34, ratio: 1.34 },
    shape: { radius: 2, stroke: 1.25, card: 'paper' },
    grid: { marginX: 0.08, marginY: 0.1, columns: 12, gutter: 0.02 },
    background: { type: 'paper', grain: 0.05, fibers: 0.5, vignette: 0.25, persistent: true },
    decor: { kicker: 'rule', rule: true, folio: true },
    motion: {
      personality: 'calm', ease: [0.25, 1, 0.5, 1], duration: 1.15, stagger: 0.12, unit: 'line',
      enter: 'mask-up', titleEnter: 'mask-up', distance: 1, blur: 0, overshoot: 0,
      camera: { type: 'push', amount: 0.4 },
      transition: { type: 'wipe', duration: 1.0, direction: 'left' }, sectionTransition: { type: 'band', duration: 1.1 },
    },
    chart: { grid: 'solid', barRadius: 0, lineWidth: 3, dot: 'solid', glow: false, area: 0.12 },
    layout: { coverAlign: 'left', titleAlign: 'left', section: 'number' },
  },

  swiss: {
    id: 'swiss',
    name: '瑞士 Swiss',
    description: '国际主义平面设计：严格网格、巨型无衬线字、红黑对比、干脆利落的滑入与色带转场。适合观点表达、品牌、海报式视频。',
    mood: ['bold', 'graphic', 'minimal', 'light'],
    scheme: 'light',
    palette: {
      bg: '#f4f3ef', bg2: '#e9e7e1', surface: '#ffffff', surface2: '#ecebe6',
      ink: '#0b0b0b', muted: '#555555', faint: '#9a9a9a', line: '#c9c7c0',
      accent: '#e30613', accent2: '#0b0b0b', accent3: '#1f5bd6',
      positive: '#0b0b0b', negative: '#e30613', warning: '#ff8a00',
      highlight: 'rgba(227,6,19,0.14)', onAccent: '#ffffff',
      data: ['#e30613', '#0b0b0b', '#8c8c8c', '#ff8a6b', '#4a4a4a', '#c9c9c9', '#9e0a12', '#1f5bd6'],
      gradient: ['#e30613', '#ff5a3c'],
    },
    tones: {
      inverse: { bg: '#0b0b0b', bg2: '#151515', surface: '#1b1b1b', ink: '#f4f3ef', muted: '#a9a9a9', faint: '#666666', line: '#3a3a3a', accent: '#ff2a2a' },
      accent: { bg: '#e30613', bg2: '#cc0511', surface: 'rgba(255,255,255,0.1)', ink: '#ffffff', muted: '#ffd0d0', faint: '#ff8e8e', line: 'rgba(255,255,255,0.4)', accent: '#0b0b0b' },
    },
    fonts: {
      display: { family: ['Motif Archivo', SANS_SC], weight: 780, tracking: -0.04, lineHeight: 0.96 },
      heading: { family: ['Motif Archivo', SANS_SC], weight: 720, tracking: -0.025, lineHeight: 1.05 },
      text: { family: ['Motif Inter', SANS_SC], weight: 450, tracking: -0.006, lineHeight: 1.45 },
      label: { family: ['Motif Archivo', SANS_SC], weight: 700, tracking: 0.04, case: 'upper', lineHeight: 1.2 },
      number: { family: ['Motif Archivo', SANS_SC], weight: 800, tracking: -0.05, lineHeight: 0.92 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 33, ratio: 1.42 },
    shape: { radius: 0, stroke: 2, card: 'flat' },
    grid: { marginX: 0.06, marginY: 0.085, columns: 12, gutter: 0.016 },
    background: { type: 'grid', columns: 12, color: 'rgba(11,11,11,0.06)', persistent: true },
    decor: { kicker: 'square', rule: true, folio: true },
    motion: {
      personality: 'crisp', ease: [0.19, 1, 0.22, 1], duration: 0.65, stagger: 0.05, unit: 'line',
      enter: 'mask-left', titleEnter: 'mask-up', distance: 1, blur: 0, overshoot: 0,
      camera: { type: 'none', amount: 0 },
      transition: { type: 'push', duration: 0.7, direction: 'left' }, sectionTransition: { type: 'band', duration: 0.85 },
    },
    chart: { grid: 'solid', barRadius: 0, lineWidth: 5, dot: 'square', glow: false, area: 0 },
    layout: { coverAlign: 'left', titleAlign: 'left', section: 'giant-number' },
  },

  blueprint: {
    id: 'blueprint',
    name: '蓝图 Blueprint',
    description: '工程蓝图风格：深蓝网格纸、线稿描边动画、等宽注释、扫描式转场。适合技术架构、工程方案、科学原理。',
    mood: ['technical', 'engineering', 'science', 'dark'],
    scheme: 'dark',
    palette: {
      bg: '#0a2540', bg2: '#0e2f52', surface: 'rgba(120,180,255,0.07)', surface2: 'rgba(120,180,255,0.13)',
      ink: '#e9f3ff', muted: '#9cbbe0', faint: '#5f84ad', line: 'rgba(150,200,255,0.34)',
      accent: '#ffcf5a', accent2: '#5be3c4', accent3: '#ff7f6e',
      positive: '#5be3c4', negative: '#ff7f6e', warning: '#ffcf5a',
      highlight: 'rgba(255,207,90,0.2)', onAccent: '#0a2540',
      data: ['#ffcf5a', '#5be3c4', '#7fb2ff', '#ff7f6e', '#c39bff', '#e9f3ff', '#ffa65c', '#9ee86b'],
      gradient: ['#5be3c4', '#7fb2ff'],
    },
    tones: {
      inverse: { bg: '#e8eef5', bg2: '#dce5ef', surface: 'rgba(10,37,64,0.05)', ink: '#0a2540', muted: '#3d5d80', faint: '#8aa1ba', line: 'rgba(10,37,64,0.3)', accent: '#d9480f' },
      accent: { bg: '#123a63', bg2: '#16457a', ink: '#ffffff', muted: '#b8d4f2', faint: '#7aa0c9', line: 'rgba(255,255,255,0.35)', surface: 'rgba(255,255,255,0.08)', accent: '#ffcf5a' },
    },
    fonts: {
      display: { family: ['Motif Grotesk', SANS_SC], weight: 600, tracking: -0.02, lineHeight: 1.06 },
      heading: { family: ['Motif Grotesk', SANS_SC], weight: 600, tracking: -0.01, lineHeight: 1.15 },
      text: { family: ['Motif Inter', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
      label: { family: ['Motif Mono', SANS_SC], weight: 500, tracking: 0.1, case: 'upper', lineHeight: 1.3, color: 'accent' },
      number: { family: ['Motif Mono', SANS_SC], weight: 600, tracking: -0.04, lineHeight: 1 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 32, ratio: 1.33 },
    shape: { radius: 3, stroke: 1.5, card: 'outline' },
    grid: { marginX: 0.075, marginY: 0.1, columns: 12, gutter: 0.02 },
    background: { type: 'blueprint', minor: 24, major: 4, color: 'rgba(140,195,255,0.09)', majorColor: 'rgba(140,195,255,0.17)', persistent: true },
    decor: { kicker: 'bracket', rule: false, ticks: true },
    motion: {
      personality: 'technical', ease: [0.2, 0.8, 0.2, 1], duration: 0.7, stagger: 0.06, unit: 'word',
      enter: 'wipe', titleEnter: 'type', distance: 0.3, blur: 0, overshoot: 0,
      camera: { type: 'drift', amount: 0.25 },
      transition: { type: 'scan', duration: 0.85, direction: 'right' }, sectionTransition: { type: 'scan', duration: 1.0, direction: 'down' },
    },
    chart: { grid: 'dashed', barRadius: 0, lineWidth: 2.5, dot: 'ring', glow: false, area: 0.14, hatch: true },
    layout: { coverAlign: 'left', titleAlign: 'left', section: 'number' },
  },

  lumen: {
    id: 'lumen',
    name: '数理 Lumen',
    description: '数学与科学讲解风格：近黑底色、粉笔般的高亮色、书写式字符动画与描线。适合公式推导、函数图像、物理与几何演示。',
    mood: ['math', 'science', 'education', 'dark'],
    scheme: 'dark',
    palette: {
      bg: '#0f1014', bg2: '#15171d', surface: 'rgba(255,255,255,0.04)', surface2: '#1c1f27',
      ink: '#eceae4', muted: '#9a978f', faint: '#5e5c57', line: 'rgba(236,234,228,0.2)',
      accent: '#ffd25e', accent2: '#58c4dd', accent3: '#83c167', accent4: '#fc6255', accent5: '#c38bd9',
      positive: '#83c167', negative: '#fc6255', warning: '#ffd25e',
      highlight: 'rgba(255,210,94,0.2)', onAccent: '#0f1014',
      data: ['#58c4dd', '#ffd25e', '#83c167', '#fc6255', '#c38bd9', '#f0a35e', '#9cdcf0', '#e8e6e0'],
      gradient: ['#58c4dd', '#83c167'],
    },
    tones: {
      inverse: { bg: '#f4f1e8', bg2: '#ebe7db', surface: 'rgba(0,0,0,0.04)', ink: '#16171b', muted: '#5c5a54', faint: '#9b978c', line: 'rgba(0,0,0,0.18)', accent: '#c47f00' },
      accent: { bg: '#1b2a3a', bg2: '#213447', ink: '#f4f1e8', muted: '#a9bccb', faint: '#6b8193', line: 'rgba(255,255,255,0.2)', surface: 'rgba(255,255,255,0.05)', accent: '#ffd25e' },
    },
    fonts: {
      display: { family: ['Motif Fraunces', SERIF_SC], weight: 480, tracking: -0.015, lineHeight: 1.08 },
      heading: { family: ['Motif Fraunces', SERIF_SC], weight: 520, tracking: -0.01, lineHeight: 1.15 },
      text: { family: ['Motif Inter', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.55 },
      label: { family: ['Motif Inter', SANS_SC], weight: 600, tracking: 0.12, case: 'upper', lineHeight: 1.3, color: 'accent' },
      number: { family: ['Motif Fraunces', SERIF_SC], weight: 500, tracking: -0.02, lineHeight: 1 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 34, ratio: 1.33 },
    shape: { radius: 10, stroke: 2, card: 'outline' },
    grid: { marginX: 0.075, marginY: 0.1, columns: 12, gutter: 0.02 },
    background: { type: 'vignette', vignette: 0.45, grain: 0.03, persistent: true },
    decor: { kicker: 'plain', rule: false },
    motion: {
      personality: 'write', ease: [0.33, 1, 0.68, 1], duration: 1.0, stagger: 0.1, unit: 'char',
      enter: 'write', titleEnter: 'write', distance: 0.15, blur: 4, overshoot: 0,
      camera: { type: 'none', amount: 0 },
      transition: { type: 'fade', duration: 0.8 }, sectionTransition: { type: 'dip', duration: 1.0 },
    },
    chart: { grid: 'solid', barRadius: 2, lineWidth: 4, dot: 'solid', glow: false, area: 0.18 },
    layout: { coverAlign: 'center', titleAlign: 'left', section: 'number' },
  },

  ink: {
    id: 'ink',
    name: '水墨 Ink',
    description: '东方水墨风格：宣纸纹理、远山墨晕、毛笔书法标题、朱砂印章与墨晕溶解转场。适合文化、历史、品牌故事、节日。',
    mood: ['chinese', 'culture', 'elegant', 'light'],
    scheme: 'light',
    palette: {
      bg: '#efe7d6', bg2: '#e6dcc6', surface: 'rgba(255,252,244,0.62)', surface2: '#e3d8c1',
      ink: '#1e1b17', muted: '#5e564b', faint: '#9b9080', line: 'rgba(30,27,23,0.22)',
      accent: '#b3261e', accent2: '#355e5b', accent3: '#a5823f',
      positive: '#355e5b', negative: '#b3261e', warning: '#a5823f',
      highlight: 'rgba(179,38,30,0.14)', onAccent: '#f8f1e3',
      data: ['#b3261e', '#355e5b', '#a5823f', '#3b3631', '#7c8f6a', '#c87f5a', '#5d6f8a', '#8a6a8f'],
      gradient: ['#1e1b17', '#5e564b'],
    },
    tones: {
      inverse: { bg: '#1c1a17', bg2: '#25221e', surface: 'rgba(255,255,255,0.05)', ink: '#efe7d6', muted: '#b5aa96', faint: '#7a7062', line: 'rgba(239,231,214,0.22)', accent: '#d9483e' },
      accent: { bg: '#2f4f4c', bg2: '#355e5b', ink: '#f3ead8', muted: '#c4d1c9', faint: '#8aa39b', line: 'rgba(243,234,216,0.3)', surface: 'rgba(255,255,255,0.06)', accent: '#e8b86a' },
    },
    fonts: {
      display: { family: ['Motif Fraunces', 'Motif Brush SC'], weight: 400, tracking: 0.02, lineHeight: 1.12, cjkScale: 1.08 },
      heading: { family: ['Motif Fraunces', SERIF_SC], weight: 650, tracking: 0.04, lineHeight: 1.25 },
      text: { family: ['Motif Fraunces', SERIF_SC], weight: 400, tracking: 0.02, lineHeight: 1.8 },
      label: { family: ['Motif Fraunces', SERIF_SC], weight: 600, tracking: 0.3, case: 'none', lineHeight: 1.3, color: 'accent' },
      number: { family: ['Motif Fraunces', SERIF_SC], weight: 500, tracking: -0.01, lineHeight: 1 },
      mono: { family: ['Motif Mono', SERIF_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 33, ratio: 1.36 },
    shape: { radius: 4, stroke: 1.5, card: 'paper' },
    grid: { marginX: 0.09, marginY: 0.11, columns: 12, gutter: 0.022 },
    background: { type: 'ink', grain: 0.06, fibers: 0.8, mountains: 0.5, seal: true, persistent: true },
    decor: { kicker: 'seal', rule: false },
    motion: {
      personality: 'flow', ease: [0.22, 0.61, 0.36, 1], duration: 1.4, stagger: 0.14, unit: 'char',
      enter: 'ink', titleEnter: 'brush', distance: 0.2, blur: 10, overshoot: 0,
      camera: { type: 'push', amount: 0.35 },
      transition: { type: 'ink', duration: 1.3 }, sectionTransition: { type: 'ink', duration: 1.6 },
    },
    chart: { grid: 'none', barRadius: 2, lineWidth: 3, dot: 'solid', glow: false, area: 0.1, brush: true },
    layout: { coverAlign: 'center', titleAlign: 'left', section: 'vertical' },
  },

  pop: {
    id: 'pop',
    name: '波普 Pop',
    description: '高饱和社交媒体风格：撞色底、粗黑描边贴纸卡片、弹簧回弹与条纹转场。适合短视频、营销、活动、年轻品牌。',
    mood: ['social', 'playful', 'marketing', 'vivid'],
    scheme: 'light',
    palette: {
      bg: '#ffe14b', bg2: '#ffd21a', surface: '#ffffff', surface2: '#fff6c7',
      ink: '#111111', muted: '#3d3a33', faint: '#6f6a5c', line: '#111111',
      accent: '#ff4f9a', accent2: '#2f5bff', accent3: '#00c2a8',
      positive: '#00a88f', negative: '#ff3b5c', warning: '#ff7a1a',
      highlight: '#ffffff', onAccent: '#ffffff',
      data: ['#ff4f9a', '#2f5bff', '#00c2a8', '#ff7a1a', '#8b5cf6', '#111111', '#ffffff', '#7ad151'],
      gradient: ['#ff4f9a', '#ff7a1a'],
    },
    tones: {
      inverse: { bg: '#2f5bff', bg2: '#2448e0', surface: '#ffffff', ink: '#ffffff', muted: '#dfe6ff', faint: '#a9b9ff', line: '#111111', accent: '#ffe14b', onAccent: '#111111' },
      accent: { bg: '#ff4f9a', bg2: '#f0388a', surface: '#ffffff', ink: '#111111', muted: '#3d1027', faint: '#7a2a52', line: '#111111', accent: '#ffe14b', onAccent: '#111111' },
    },
    fonts: {
      display: { family: ['Motif Archivo', SANS_SC], weight: 900, stretch: 'expanded', tracking: -0.025, lineHeight: 0.98 },
      heading: { family: ['Motif Archivo', SANS_SC], weight: 850, stretch: 'semi-expanded', tracking: -0.015, lineHeight: 1.05 },
      text: { family: ['Motif Outfit', SANS_SC], weight: 500, tracking: 0, lineHeight: 1.4 },
      label: { family: ['Motif Archivo', SANS_SC], weight: 800, tracking: 0.04, case: 'upper', lineHeight: 1.2 },
      number: { family: ['Motif Archivo', SANS_SC], weight: 900, stretch: 'expanded', tracking: -0.04, lineHeight: 0.95 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 500, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 34, ratio: 1.4 },
    shape: { radius: 20, stroke: 4, card: 'brutal' },
    grid: { marginX: 0.07, marginY: 0.09, columns: 12, gutter: 0.02 },
    background: { type: 'pop', shapes: 0.6, dots: 0.5, persistent: false },
    decor: { kicker: 'sticker', rule: false },
    motion: {
      personality: 'bouncy', ease: [0.34, 1.56, 0.64, 1], duration: 0.7, stagger: 0.06, unit: 'word',
      enter: 'pop', titleEnter: 'slam', distance: 0.5, blur: 0, overshoot: 0.6,
      spring: { stiffness: 210, damping: 13 },
      camera: { type: 'none', amount: 0 },
      transition: { type: 'stripes', duration: 0.75, direction: 'left' }, sectionTransition: { type: 'iris', duration: 0.85 },
    },
    chart: { grid: 'none', barRadius: 14, lineWidth: 7, dot: 'outlined', glow: false, area: 0, outline: true },
    layout: { coverAlign: 'center', titleAlign: 'left', section: 'sticker' },
  },

  corporate: {
    id: 'corporate',
    name: '商务 Corporate',
    description: '清晰克制的商务风格：浅灰白底、蓝青强调、白色悬浮卡片、平稳上浮入场与推移转场。适合工作汇报、方案、培训。',
    mood: ['business', 'clean', 'report', 'light'],
    scheme: 'light',
    palette: {
      bg: '#f6f7f9', bg2: '#eef1f5', surface: '#ffffff', surface2: '#f1f4f8',
      ink: '#0e1a2b', muted: '#536276', faint: '#8d99a8', line: '#dde3ea',
      accent: '#2563eb', accent2: '#0fb5a6', accent3: '#f59e0b',
      positive: '#0f9f6e', negative: '#e5484d', warning: '#f59e0b',
      highlight: 'rgba(37,99,235,0.12)', onAccent: '#ffffff',
      data: ['#2563eb', '#0fb5a6', '#f59e0b', '#7c3aed', '#ef4444', '#0ea5e9', '#65a30d', '#64748b'],
      gradient: ['#2563eb', '#0fb5a6'],
    },
    tones: {
      inverse: { bg: '#0e1a2b', bg2: '#13233a', surface: '#17293f', ink: '#f2f5f9', muted: '#9fb0c5', faint: '#62758c', line: '#253a55', accent: '#5b8cff' },
      accent: { bg: '#2563eb', bg2: '#1f56d0', surface: 'rgba(255,255,255,0.12)', ink: '#ffffff', muted: '#d4e1ff', faint: '#9db8f5', line: 'rgba(255,255,255,0.3)', accent: '#ffffff' },
    },
    fonts: {
      display: { family: ['Motif Inter', SANS_SC], weight: 720, tracking: -0.032, lineHeight: 1.06 },
      heading: { family: ['Motif Inter', SANS_SC], weight: 680, tracking: -0.02, lineHeight: 1.15 },
      text: { family: ['Motif Inter', SANS_SC], weight: 400, tracking: -0.005, lineHeight: 1.5 },
      label: { family: ['Motif Inter', SANS_SC], weight: 650, tracking: 0.1, case: 'upper', lineHeight: 1.3, color: 'accent' },
      number: { family: ['Motif Inter', SANS_SC], weight: 720, tracking: -0.045, lineHeight: 1 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 32, ratio: 1.33 },
    shape: { radius: 16, stroke: 1.5, card: 'elevated' },
    grid: { marginX: 0.075, marginY: 0.1, columns: 12, gutter: 0.018 },
    background: { type: 'soft', tint: 0.07, dots: 0.35, persistent: true },
    decor: { kicker: 'bar', rule: false },
    motion: {
      personality: 'smooth', ease: [0.22, 1, 0.36, 1], duration: 0.75, stagger: 0.07, unit: 'word',
      enter: 'rise', titleEnter: 'rise', distance: 0.4, blur: 0, overshoot: 0,
      camera: { type: 'drift', amount: 0.25 },
      transition: { type: 'push', duration: 0.75, direction: 'left' }, sectionTransition: { type: 'slide', duration: 0.9, direction: 'up' },
    },
    chart: { grid: 'solid', barRadius: 6, lineWidth: 3.5, dot: 'ring', glow: false, area: 0.16 },
    layout: { coverAlign: 'left', titleAlign: 'left', section: 'number' },
  },

  noir: {
    id: 'noir',
    name: '暗场 Noir',
    description: '电影片头风格：纯黑画面、优雅衬线、金色点缀、胶片颗粒、慢速失焦入场与黑场转场。适合预告、开场、品牌大片、发布会序幕。',
    mood: ['cinematic', 'luxury', 'dramatic', 'dark'],
    scheme: 'dark',
    palette: {
      bg: '#060606', bg2: '#0f0e0c', surface: 'rgba(255,255,255,0.04)', surface2: '#161412',
      ink: '#f3eee4', muted: '#9b9386', faint: '#5a554d', line: 'rgba(243,238,228,0.18)',
      accent: '#d6a85c', accent2: '#a33a32', accent3: '#7d93a8',
      positive: '#9fb88a', negative: '#c25a4f', warning: '#d6a85c',
      highlight: 'rgba(214,168,92,0.2)', onAccent: '#0b0a08',
      data: ['#d6a85c', '#f3eee4', '#a33a32', '#7d93a8', '#8e7a5c', '#c9c2b5', '#5f6f5c', '#b46f4a'],
      gradient: ['#f3d9a4', '#d6a85c', '#8e6a32'],
    },
    tones: {
      inverse: { bg: '#efe9de', bg2: '#e4ddcf', surface: 'rgba(0,0,0,0.04)', ink: '#0b0a08', muted: '#5a554d', faint: '#9b9386', line: 'rgba(0,0,0,0.18)', accent: '#9a6f28' },
      accent: { bg: '#15110b', bg2: '#21190e', ink: '#f6e7c8', muted: '#c2a77a', faint: '#7d6a4a', line: 'rgba(214,168,92,0.3)', surface: 'rgba(214,168,92,0.06)', accent: '#e9c47f' },
    },
    fonts: {
      display: { family: ['Motif Instrument', SERIF_SC], weight: 400, tracking: -0.01, lineHeight: 1.02, cjkWeight: 500 },
      heading: { family: ['Motif Instrument', SERIF_SC], weight: 400, tracking: 0, lineHeight: 1.12 },
      text: { family: ['Motif Inter', SANS_SC], weight: 300, tracking: 0.01, lineHeight: 1.65 },
      label: { family: ['Motif Inter', SANS_SC], weight: 500, tracking: 0.34, case: 'upper', lineHeight: 1.3, color: 'accent' },
      number: { family: ['Motif Instrument', SERIF_SC], weight: 400, tracking: -0.02, lineHeight: 1 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 300, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 33, ratio: 1.42 },
    shape: { radius: 2, stroke: 1, card: 'line' },
    grid: { marginX: 0.1, marginY: 0.14, columns: 12, gutter: 0.02 },
    background: { type: 'noir', vignette: 0.7, grain: 0.07, leak: 0.35, letterbox: 0.06, persistent: true },
    decor: { kicker: 'rule-center', rule: false },
    motion: {
      personality: 'cinematic', ease: [0.16, 1, 0.3, 1], duration: 1.8, stagger: 0.22, unit: 'line',
      enter: 'focus', titleEnter: 'focus', distance: 0.1, blur: 18, overshoot: 0,
      camera: { type: 'push', amount: 0.8 },
      transition: { type: 'dip', duration: 1.2, color: '#000000' }, sectionTransition: { type: 'dip', duration: 1.6, color: '#000000' },
    },
    chart: { grid: 'none', barRadius: 0, lineWidth: 2, dot: 'ring', glow: true, area: 0.08 },
    layout: { coverAlign: 'center', titleAlign: 'center', section: 'rule' },
  },

  meadow: {
    id: 'meadow',
    name: '青野 Meadow',
    description: '清新友好的教育风格：浅鼠尾草绿底、有机色块、圆润字体、柔和弹性入场与圆形展开转场。适合课程、科普、健康、公益。',
    mood: ['education', 'friendly', 'fresh', 'light'],
    scheme: 'light',
    palette: {
      bg: '#f1f4ec', bg2: '#e5ecdc', surface: '#ffffff', surface2: '#eaf1e2',
      ink: '#1d2a22', muted: '#56685d', faint: '#93a399', line: '#d3decf',
      accent: '#2e9e6a', accent2: '#f0a03c', accent3: '#4a9fe0',
      positive: '#2e9e6a', negative: '#e0596f', warning: '#f0a03c',
      highlight: 'rgba(240,160,60,0.25)', onAccent: '#ffffff',
      data: ['#2e9e6a', '#f0a03c', '#4a9fe0', '#e8677d', '#8a6fd6', '#7cc4a0', '#f4c95d', '#5b6b62'],
      gradient: ['#2e9e6a', '#4a9fe0'],
    },
    tones: {
      inverse: { bg: '#1f3a2d', bg2: '#244435', surface: 'rgba(255,255,255,0.07)', ink: '#f1f4ec', muted: '#b8cbbd', faint: '#7d9586', line: 'rgba(241,244,236,0.2)', accent: '#7fd6a8' },
      accent: { bg: '#1f7a50', bg2: '#1a6c46', surface: 'rgba(255,255,255,0.14)', ink: '#ffffff', muted: '#d7f2e3', faint: '#9fd9bb', line: 'rgba(255,255,255,0.35)', accent: '#ffe08a' },
    },
    fonts: {
      display: { family: ['Motif Outfit', SANS_SC], weight: 700, tracking: -0.022, lineHeight: 1.05 },
      heading: { family: ['Motif Outfit', SANS_SC], weight: 650, tracking: -0.012, lineHeight: 1.15 },
      text: { family: ['Motif Outfit', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
      label: { family: ['Motif Outfit', SANS_SC], weight: 650, tracking: 0.08, case: 'upper', lineHeight: 1.3, color: 'accent' },
      number: { family: ['Motif Outfit', SANS_SC], weight: 700, tracking: -0.03, lineHeight: 1 },
      mono: { family: ['Motif Mono', SANS_SC], weight: 400, tracking: 0, lineHeight: 1.5 },
    },
    type: { base: 34, ratio: 1.33 },
    shape: { radius: 26, stroke: 2, card: 'elevated' },
    grid: { marginX: 0.075, marginY: 0.1, columns: 12, gutter: 0.02 },
    background: { type: 'blobs', colors: ['#cfe8d6', '#fde3c0', '#d4e8f7'], intensity: 0.9, dots: 0.25, persistent: true },
    decor: { kicker: 'pill', rule: false },
    motion: {
      personality: 'gentle', ease: [0.34, 1.3, 0.64, 1], duration: 0.9, stagger: 0.08, unit: 'word',
      enter: 'pop-soft', titleEnter: 'rise', distance: 0.4, blur: 0, overshoot: 0.25,
      spring: { stiffness: 140, damping: 15 },
      camera: { type: 'drift', amount: 0.3 },
      transition: { type: 'slide', duration: 0.85, direction: 'left' }, sectionTransition: { type: 'iris', duration: 1.0 },
    },
    chart: { grid: 'dashed', barRadius: 12, lineWidth: 4.5, dot: 'outlined', glow: false, area: 0.2 },
    layout: { coverAlign: 'left', titleAlign: 'left', section: 'number' },
  },
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'aurora';

export function getTheme(id) {
  return THEMES[id] || null;
}

/** Short listing for CLI/AI. */
export function themeSummaries() {
  return Object.values(THEMES).map((t) => ({ id: t.id, name: t.name, scheme: t.scheme, mood: t.mood, description: t.description }));
}
