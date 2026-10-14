// Seeded demo data for the whole console. Every figure is simulated; nothing here talks to a server.
// Dates are relative to the moment the page loads so the console always looks "current".

import { rng, clamp } from './util.js';

const R = rng(20261013);
export const NOW = Date.now();
const DAY = 86400000;
const HOUR = 3600000;

// ---- model marketplace -----------------------------------------------------------------------

export const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: 'chat', label: '对话' },
  { id: 'reason', label: '推理' },
  { id: 'code', label: '代码' },
  { id: 'vision', label: '视觉' },
  { id: 'embed', label: '嵌入' },
  { id: 'audio', label: '语音' },
  { id: 'image', label: '图像' },
];

export const PROVIDERS = {
  tensora: { name: '星枢自研', hue: 190 },
  aurion: { name: 'Aurion', hue: 265 },
  nebulos: { name: 'Nebulos', hue: 150 },
  quillon: { name: 'Quillon', hue: 30 },
  halcyon: { name: 'Halcyon', hue: 220 },
  corvid: { name: 'Corvid', hue: 330 },
  veyra: { name: 'Veyra', hue: 55 },
};

// price: ¥ per 1M tokens (in / out). unit models carry their own `unit` label instead.
export const MODELS = [
  { id: 'tensora-ultra-2', name: 'Tensora Ultra 2', provider: 'tensora', cat: 'chat', tags: ['旗舰', '多模态', '工具调用'], ctx: 1_000_000, pin: 12, pout: 48, ttft: 420, tps: 96, uptime: 99.98, calls: 18_420_000, score: 92.4, released: NOW - 9 * DAY, isNew: true, featured: true,
    desc: '星枢旗舰通用模型。百万级上下文，原生支持图像与文档输入、并行工具调用和结构化输出，适合复杂智能体与企业知识库。' },
  { id: 'tensora-swift', name: 'Tensora Swift', provider: 'tensora', cat: 'chat', tags: ['低延迟', '高并发'], ctx: 256_000, pin: 0.8, pout: 3.2, ttft: 140, tps: 212, uptime: 99.99, calls: 42_870_000, score: 81.6, released: NOW - 64 * DAY,
    desc: '为在线客服、实时对话与高并发场景调优的轻量模型，首字延迟低于 150 ms，单价约为旗舰的十五分之一。' },
  { id: 'tensora-reason-r1', name: 'Tensora Reason R1', provider: 'tensora', cat: 'reason', tags: ['深度思考', '数学', '规划'], ctx: 512_000, pin: 16, pout: 64, ttft: 1350, tps: 74, uptime: 99.95, calls: 6_210_000, score: 94.1, released: NOW - 21 * DAY, isNew: true,
    desc: '带可控思考预算的推理模型。适合数学证明、代码审查、多步规划等需要长链条推理的任务。' },
  { id: 'aurion-5-pro', name: 'Aurion-5 Pro', provider: 'aurion', cat: 'reason', tags: ['推理', '长上下文'], ctx: 400_000, pin: 10, pout: 40, ttft: 980, tps: 81, uptime: 99.93, calls: 9_870_000, score: 93.2, released: NOW - 48 * DAY,
    desc: '第三方顶级推理模型，在研究、分析与复杂指令遵循上表现稳定。通过星枢网关统一计费与限流。' },
  { id: 'aurion-5-mini', name: 'Aurion-5 Mini', provider: 'aurion', cat: 'chat', tags: ['性价比'], ctx: 400_000, pin: 1.6, pout: 6.4, ttft: 260, tps: 158, uptime: 99.96, calls: 21_330_000, score: 85.0, released: NOW - 48 * DAY,
    desc: 'Aurion-5 家族的高性价比版本，适合批量摘要、分类与信息抽取。' },
  { id: 'nebulos-coder-3', name: 'Nebulos Coder 3', provider: 'nebulos', cat: 'code', tags: ['代码', '仓库级上下文', 'FIM'], ctx: 256_000, pin: 4, pout: 16, ttft: 310, tps: 132, uptime: 99.9, calls: 12_640_000, score: 90.8, released: NOW - 33 * DAY,
    desc: '面向代码生成、补全与重构的专用模型，支持中间填充 (FIM) 与仓库级检索增强。' },
  { id: 'nebulos-lite-8b', name: 'Nebulos Lite 8B', provider: 'nebulos', cat: 'chat', tags: ['开源权重', '可微调'], ctx: 128_000, pin: 0.3, pout: 0.6, ttft: 90, tps: 268, uptime: 99.97, calls: 15_020_000, score: 72.3, released: NOW - 120 * DAY,
    desc: '开源权重的小参数模型，可在星枢训练平台上做 LoRA / 全参微调后一键部署为专属端点。' },
  { id: 'quillon-vision-xl', name: 'Quillon Vision XL', provider: 'quillon', cat: 'vision', tags: ['图像理解', '图表', '视频帧'], ctx: 200_000, pin: 6, pout: 24, ttft: 520, tps: 88, uptime: 99.91, calls: 4_380_000, score: 89.7, released: NOW - 15 * DAY, isNew: true,
    desc: '高分辨率视觉理解模型，擅长图表、截图、工业质检图像与视频关键帧分析。' },
  { id: 'quillon-doc-ocr', name: 'Quillon DocOCR', provider: 'quillon', cat: 'vision', tags: ['OCR', '版面分析'], ctx: 64_000, pin: 2, pout: 2, ttft: 380, tps: 140, uptime: 99.94, calls: 3_120_000, score: 86.1, released: NOW - 90 * DAY,
    desc: '复杂版面文档解析：表格、公式、手写体与多栏排版，输出 Markdown 或 JSON。' },
  { id: 'halcyon-embed-v4', name: 'Halcyon Embed v4', provider: 'halcyon', cat: 'embed', tags: ['3072 维', '多语言'], ctx: 8_192, pin: 0.5, pout: 0, ttft: 35, tps: 0, uptime: 99.99, calls: 58_900_000, score: 88.3, released: NOW - 75 * DAY,
    desc: '多语言文本嵌入模型，支持 Matryoshka 截断维度，适合检索、聚类与去重。' },
  { id: 'halcyon-rerank-2', name: 'Halcyon Rerank 2', provider: 'halcyon', cat: 'embed', tags: ['重排序'], ctx: 16_384, pin: 1, pout: 0, ttft: 60, tps: 0, uptime: 99.98, calls: 11_400_000, score: 87.5, released: NOW - 110 * DAY,
    desc: '交叉编码重排序模型，在 RAG 检索结果上平均提升 12% 的命中率。' },
  { id: 'corvid-voice-2', name: 'Corvid Voice 2', provider: 'corvid', cat: 'audio', tags: ['TTS', '情感语调', '流式'], ctx: 4_096, unit: '¥0.12 / 千字符', pin: 0, pout: 0, ttft: 180, tps: 0, uptime: 99.92, calls: 2_640_000, score: 84.9, released: NOW - 40 * DAY,
    desc: '自然度极高的语音合成，支持 30 种音色、情感控制与 200 ms 内首包流式输出。' },
  { id: 'corvid-listen', name: 'Corvid Listen', provider: 'corvid', cat: 'audio', tags: ['ASR', '说话人分离'], ctx: 0, unit: '¥0.9 / 小时音频', pin: 0, pout: 0, ttft: 240, tps: 0, uptime: 99.95, calls: 1_870_000, score: 86.6, released: NOW - 58 * DAY,
    desc: '多语种语音识别，内置说话人分离、热词增强与时间戳对齐。' },
  { id: 'veyra-canvas-3', name: 'Veyra Canvas 3', provider: 'veyra', cat: 'image', tags: ['文生图', '4K', '局部重绘'], ctx: 0, unit: '¥0.28 / 张', pin: 0, pout: 0, ttft: 3200, tps: 0, uptime: 99.82, calls: 960_000, score: 88.0, released: NOW - 6 * DAY, isNew: true,
    desc: '高保真图像生成模型，支持 4K 输出、精确文字渲染、参考图风格迁移与局部重绘。' },
  { id: 'veyra-motion', name: 'Veyra Motion', provider: 'veyra', cat: 'image', tags: ['视频生成', '公测'], ctx: 0, unit: '¥2.4 / 秒视频', pin: 0, pout: 0, ttft: 42000, tps: 0, uptime: 99.4, calls: 120_000, score: 82.2, released: NOW - 3 * DAY, isNew: true,
    desc: '文本 / 图像生成 1080p 短视频，单段最长 12 秒，公测期间按秒计费。' },
  { id: 'aurion-5-nano', name: 'Aurion-5 Nano', provider: 'aurion', cat: 'chat', tags: ['边缘', '极低价'], ctx: 128_000, pin: 0.2, pout: 0.8, ttft: 70, tps: 310, uptime: 99.97, calls: 26_100_000, score: 74.8, released: NOW - 48 * DAY,
    desc: '极低单价的分类、路由与意图识别模型，常用于智能体的前置分流。' },
];

// ---- API keys ------------------------------------------------------------------------------

const keyTail = () => Array.from({ length: 4 }, () => '0123456789abcdef'[Math.floor(R() * 16)]).join('');
const series = (n, base, vol, trend = 0) => {
  let v = base;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, v * (1 + trend) + R.gauss() * vol);
    return Math.round(v + Math.sin(i / 2) * vol * 0.4);
  });
};

export const KEYS = [
  { id: 'k1', name: '生产 · 智能客服', env: 'prod', tail: keyTail(), created: NOW - 210 * DAY, lastUsed: NOW - 4000, scopes: ['chat', 'embed'], models: ['tensora-swift', 'halcyon-embed-v4', 'halcyon-rerank-2'], rpm: 6000, quota: 60000, spent: 36560, enabled: true, owner: '林知远', usage: series(14, 6.2e6, 3.4e5, 0.01) },
  { id: 'k2', name: '生产 · 代码助手', env: 'prod', tail: keyTail(), created: NOW - 160 * DAY, lastUsed: NOW - 12000, scopes: ['chat', 'code'], models: ['nebulos-coder-3', 'tensora-ultra-2'], rpm: 3000, quota: 40000, spent: 31640, enabled: true, owner: '周屿', usage: series(14, 2.9e6, 2.1e5, 0.02) },
  { id: 'k3', name: '研究组 · 模型评测', env: 'prod', tail: keyTail(), created: NOW - 98 * DAY, lastUsed: NOW - 3 * 60000, scopes: ['all'], models: [], rpm: 1200, quota: 30000, spent: 10290, enabled: true, owner: '沈墨', usage: series(14, 8e5, 1.6e5) },
  { id: 'k4', name: '移动端 App', env: 'prod', tail: keyTail(), created: NOW - 73 * DAY, lastUsed: NOW - 50000, scopes: ['chat', 'audio'], models: ['tensora-swift', 'corvid-voice-2', 'corvid-listen'], rpm: 4000, quota: 30000, spent: 20980, enabled: true, owner: '许嘉禾', usage: series(14, 2.2e6, 1.4e5, 0.015) },
  { id: 'k5', name: '测试 · 数据标注', env: 'test', tail: keyTail(), created: NOW - 41 * DAY, lastUsed: NOW - 6 * HOUR, scopes: ['vision', 'chat'], models: ['quillon-vision-xl', 'quillon-doc-ocr'], rpm: 600, quota: 8000, spent: 1850, enabled: true, owner: '陆青', usage: series(14, 2.5e5, 5e4) },
  { id: 'k6', name: '合作伙伴 · 星河出行', env: 'prod', tail: keyTail(), created: NOW - 30 * DAY, lastUsed: NOW - 20 * 60000, scopes: ['chat'], models: ['aurion-5-mini', 'aurion-5-nano'], rpm: 2000, quota: 20000, spent: 6290, enabled: true, owner: '何夕', usage: series(14, 1.1e6, 9e4, 0.03) },
  { id: 'k7', name: '临时 · 黑客松', env: 'test', tail: keyTail(), created: NOW - 19 * DAY, lastUsed: NOW - 9 * DAY, scopes: ['all'], models: [], rpm: 300, quota: 3000, spent: 2995, enabled: false, owner: '林知远', usage: series(14, 6e4, 1.5e4, -0.08) },
];

// ---- GPU cluster ---------------------------------------------------------------------------

export const POOLS = [
  { id: 'sh', name: '华东 · 上海', short: '上海', gpu: 'H200 141GB', mem: 141, tdp: 700, nodes: 8 },
  { id: 'wl', name: '华北 · 乌兰察布', short: '乌兰察布', gpu: 'H100 80GB SXM', mem: 80, tdp: 700, nodes: 6 },
  { id: 'sg', name: '新加坡', short: '新加坡', gpu: 'L40S 48GB', mem: 48, tdp: 350, nodes: 2 },
];

export const NODES = [];
export const GPUS = [];
{
  let gi = 0;
  for (const pool of POOLS) {
    for (let n = 0; n < pool.nodes; n++) {
      const node = { id: `${pool.id}-${pool.gpu.split(' ')[0].toLowerCase()}-${String(n + 1).padStart(2, '0')}`, pool: pool.id, index: n, gpus: [], status: 'ok', cpu: R.range(22, 64), ram: R.range(0.4, 0.82), net: R.range(40, 340), uptime: R.range(3, 96) * DAY };
      for (let g = 0; g < 8; g++) {
        const busy = R() < 0.84;
        const util = busy ? R.range(62, 99) : R.range(0, 12);
        const gpu = { i: gi++, node: node.id, pool: pool.id, slot: g, util, mem: busy ? R.range(0.55, 0.96) : R.range(0.02, 0.1), temp: 38 + util * 0.36 + R.range(-3, 4), power: 0, job: null, status: 'ok', ecc: 0 };
        gpu.power = pool.tdp * (0.18 + 0.78 * util / 100);
        node.gpus.push(gpu);
        GPUS.push(gpu);
      }
      NODES.push(node);
    }
  }
  // a hot GPU and an ECC failure so the health states have something to show
  const hot = GPUS[21]; hot.util = 98; hot.temp = 87.5; hot.status = 'warn';
  const dead = GPUS[83]; dead.util = 0; dead.mem = 0; dead.temp = 31; dead.power = 0; dead.status = 'crit'; dead.ecc = 14;
  NODES.find((n) => n.id === hot.node).status = 'warn';
  NODES.find((n) => n.id === dead.node).status = 'crit';
}

// ---- training jobs --------------------------------------------------------------------------

function lossCurve(steps, start, floor, noise, seed) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = i / Math.max(1, steps - 1);
    out.push(floor + (start - floor) * Math.exp(-4.2 * t) + r.gauss() * noise * (1 - t * 0.6));
  }
  return out;
}

export const BASE_MODELS = [
  { id: 'nebulos-lite-8b', name: 'Nebulos Lite 8B', params: '8B', ctx: '128K', vram: 1 },
  { id: 'nebulos-32b', name: 'Nebulos 32B', params: '32B', ctx: '128K', vram: 4 },
  { id: 'tensora-swift', name: 'Tensora Swift (开放微调)', params: '24B', ctx: '256K', vram: 3 },
  { id: 'nebulos-moe-120b', name: 'Nebulos MoE 120B-A12B', params: '120B', ctx: '128K', vram: 12 },
];

export const DATASETS = [
  { id: 'ds1', name: '客服对话 · 2026Q3 精标', rows: 184_200, tokens: 92e6, format: 'JSONL · messages', quality: 96, updated: NOW - 2 * DAY, tag: 'SFT' },
  { id: 'ds2', name: '内部代码库 · 去敏', rows: 1_240_000, tokens: 1.84e9, format: 'JSONL · FIM', quality: 91, updated: NOW - 6 * DAY, tag: '代码' },
  { id: 'ds3', name: '多语种平行语料', rows: 3_600_000, tokens: 620e6, format: 'Parquet', quality: 88, updated: NOW - 13 * DAY, tag: '翻译' },
  { id: 'ds4', name: '偏好对 · 安全对齐', rows: 82_400, tokens: 71e6, format: 'JSONL · chosen/rejected', quality: 93, updated: NOW - 4 * DAY, tag: 'DPO' },
  { id: 'ds5', name: '工业质检图像', rows: 46_800, tokens: 0, format: '图像 + 标注', quality: 89, updated: NOW - 20 * DAY, tag: '视觉' },
];

export const JOBS = [
  { id: 'ft-7f3a', name: '客服意图微调 v3', base: 'tensora-swift', method: 'LoRA r=64', dataset: 'ds1', status: 'running', progress: 0.62, gpus: 16, pool: 'sh', started: NOW - 5.2 * HOUR, eta: 3.1 * 3600, steps: 12000, owner: '林知远', loss: lossCurve(120, 2.6, 0.82, 0.05, 11), lr: 2e-4, cost: 6120, color: 1 },
  { id: 'ft-91c2', name: '代码补全 · 仓库级 FIM', base: 'nebulos-32b', method: '全参微调', dataset: 'ds2', status: 'running', progress: 0.31, gpus: 32, pool: 'wl', started: NOW - 9.4 * HOUR, eta: 20.7 * 3600, steps: 40000, owner: '周屿', loss: lossCurve(120, 3.1, 1.02, 0.06, 12), lr: 1e-5, cost: 18440, color: 2 },
  { id: 'ft-c40d', name: '工业质检视觉 LoRA', base: 'nebulos-lite-8b', method: 'QLoRA 4bit', dataset: 'ds5', status: 'running', progress: 0.88, gpus: 8, pool: 'sh', started: NOW - 2.6 * HOUR, eta: 0.35 * 3600, steps: 6000, owner: '陆青', loss: lossCurve(120, 1.9, 0.41, 0.04, 13), lr: 3e-4, cost: 980, color: 3 },
  { id: 'ft-2b77', name: '安全对齐 DPO', base: 'nebulos-32b', method: 'DPO β=0.1', dataset: 'ds4', status: 'paused', progress: 0.47, gpus: 16, pool: 'wl', started: NOW - 14 * HOUR, eta: 7.5 * 3600, steps: 8000, owner: '沈墨', loss: lossCurve(120, 0.69, 0.31, 0.03, 14), lr: 5e-7, cost: 7340, color: 4 },
  { id: 'ft-5e19', name: '多语种翻译 SFT', base: 'nebulos-moe-120b', method: '全参微调', dataset: 'ds3', status: 'queued', progress: 0, gpus: 64, pool: 'sh', started: null, eta: 31 * 3600, steps: 24000, owner: '何夕', loss: [], lr: 8e-6, cost: 0, color: 5 },
  { id: 'ft-a803', name: '医疗问答 SFT', base: 'nebulos-lite-8b', method: 'LoRA r=32', dataset: 'ds1', status: 'completed', progress: 1, gpus: 8, pool: 'sg', started: NOW - 2.2 * DAY, eta: 0, steps: 5000, owner: '许嘉禾', loss: lossCurve(120, 2.2, 0.58, 0.035, 15), lr: 2e-4, cost: 2210, color: 6, finished: NOW - 1.6 * DAY },
  { id: 'ft-6d1e', name: '长文本摘要 v2', base: 'tensora-swift', method: 'LoRA r=128', dataset: 'ds1', status: 'failed', progress: 0.23, gpus: 16, pool: 'wl', started: NOW - 1.1 * DAY, eta: 0, steps: 9000, owner: '周屿', loss: lossCurve(28, 2.8, 1.6, 0.06, 16), lr: 1e-4, cost: 1460, color: 7, error: 'CUDA out of memory: rank 11 尝试分配 18.4 GiB（序列长度 65536，micro-batch 4）', finished: NOW - 0.9 * DAY },
];

for (const j of JOBS) {
  // validation loss tracks training loss with a small generalisation gap
  const r = rng(j.id.length * 97 + j.steps);
  j.valIdx = j.loss.map((_, i) => i).filter((i) => i % 6 === 5);
  j.val = j.valIdx.map((i) => j.loss[i] * 1.05 + 0.04 + r.gauss() * 0.015);
  j.gpuUtil = Array.from({ length: Math.min(j.gpus, 8) }, () => series(40, 88, 3).map((v) => clamp(v, 40, 100)));
}

// ---- traffic history ---------------------------------------------------------------------------

/** Hourly request counts for the last `days` days with a daily rhythm and weekday dip. */
export function trafficHistory(hours, seed = 5) {
  const r = rng(seed);
  const out = [];
  const start = NOW - hours * HOUR;
  for (let i = 0; i < hours; i++) {
    const t = start + i * HOUR;
    const h = new Date(t).getHours();
    const dow = new Date(t).getDay();
    const daily = 0.62 + 0.38 * Math.sin(((h - 9) / 24) * Math.PI * 2); // peaks mid-afternoon, low before dawn
    const wk = dow === 0 || dow === 6 ? 0.78 : 1;
    const growth = 1 + (i / hours) * 0.12;
    const base = 0.98e6 * daily * wk * growth;
    out.push({ t, v: Math.round(base * (1 + r.gauss() * 0.04)) });
  }
  return out;
}

export const DAILY_TOKENS = (() => {
  const r = rng(77);
  const days = 182;
  return Array.from({ length: days }, (_, i) => {
    const t = NOW - (days - 1 - i) * DAY;
    const dow = new Date(t).getDay();
    const growth = 0.55 + 0.45 * (i / days);
    const wk = dow === 0 || dow === 6 ? 0.62 : 1;
    const spike = r() < 0.04 ? 1.5 : 1;
    const total = 5.6e9 * growth * wk * spike * (1 + r.gauss() * 0.08);
    const outShare = 0.24 + r.gauss() * 0.015;
    const cached = 0.31 + r.gauss() * 0.03;
    return { t, input: total * (1 - outShare), output: total * outShare, cached: total * (1 - outShare) * cached };
  });
})();

// cost per day split by service (¥)
export const SERVICES = [
  { id: 'infer', name: '推理 API' },
  { id: 'train', name: '训练算力' },
  { id: 'store', name: '存储与数据' },
  { id: 'net', name: '网络与专线' },
];

export const DAILY_COST = (() => {
  const r = rng(303);
  const today = new Date(NOW);
  const dayOfMonth = today.getDate();
  return Array.from({ length: 30 }, (_, i) => {
    const t = NOW - (29 - i) * DAY;
    const dow = new Date(t).getDay();
    const wk = dow === 0 || dow === 6 ? 0.8 : 1;
    const burst = i > 18 && i < 24 ? 1.45 : 1;
    return {
      t,
      infer: Math.round(8000 * wk * (1 + i / 90) * (1 + r.gauss() * 0.06)),
      train: Math.round(9500 * burst * (1 + r.gauss() * 0.18)),
      store: Math.round(1300 + i * 8 + r.gauss() * 40),
      net: Math.round(500 * wk * (1 + r.gauss() * 0.08)),
      inMonth: i >= 30 - dayOfMonth,
    };
  });
})();

export const MTD_COST = DAILY_COST.filter((d) => d.inMonth).reduce((a, d) => a + d.infer + d.train + d.store + d.net, 0);

export const TEAMS = [
  { name: '智能客服', infer: 55200, train: 17700, budget: 160000, lead: '林知远' },
  { name: '开发者工具', infer: 40500, train: 38100, budget: 150000, lead: '周屿' },
  { name: '基础研究', infer: 13600, train: 44000, budget: 140000, lead: '沈墨' },
  { name: '移动端', infer: 25300, train: 2700, budget: 60000, lead: '许嘉禾' },
  { name: '数据平台', infer: 5500, train: 9200, budget: 40000, lead: '陆青' },
];

export const INVOICES = [
  { id: 'INV-2026-09', period: '2026 年 9 月', amount: 486_220, status: 'paid', issued: NOW - 12 * DAY },
  { id: 'INV-2026-08', period: '2026 年 8 月', amount: 441_870, status: 'paid', issued: NOW - 43 * DAY },
  { id: 'INV-2026-07', period: '2026 年 7 月', amount: 398_400, status: 'paid', issued: NOW - 73 * DAY },
  { id: 'INV-2026-06', period: '2026 年 6 月', amount: 352_160, status: 'paid', issued: NOW - 104 * DAY },
];

// ---- events / notifications ---------------------------------------------------------------------

export const NOTIFICATIONS = [
  { id: 'n1', level: 'crit', title: 'GPU 硬件故障', body: `${GPUS[83].node} · GPU ${GPUS[83].slot} 出现 14 次不可纠正 ECC 错误，已自动隔离。`, at: NOW - 7 * 60000, link: `cluster/${GPUS[83].node}`, read: false },
  { id: 'n2', level: 'warn', title: 'GPU 温度偏高', body: `${GPUS[21].node} · GPU ${GPUS[21].slot} 持续 87 °C 以上，建议检查机柜风道。`, at: NOW - 18 * 60000, link: `cluster/${GPUS[21].node}`, read: false },
  { id: 'n3', level: 'good', title: '训练完成', body: '「医疗问答 SFT」已完成，验证损失 0.61，可一键部署为专属端点。', at: NOW - 1.6 * DAY, link: 'jobs/ft-a803', read: false },
  { id: 'n4', level: 'warn', title: '密钥额度即将用尽', body: '「生产 · 代码助手」本月已用 78% 额度，按当前速度约 5 天后触顶。', at: NOW - 3 * HOUR, link: 'keys', read: true },
  { id: 'n5', level: 'crit', title: '训练任务失败', body: '「长文本摘要 v2」因显存不足终止，建议降低 micro-batch 或开启梯度检查点。', at: NOW - 0.9 * DAY, link: 'jobs/ft-6d1e', read: true },
  { id: 'n6', level: 'info', title: '新模型上架', body: 'Veyra Motion 视频生成模型开放公测，按秒计费。', at: NOW - 3 * DAY, link: 'models/veyra-motion', read: true },
];

export const TEAM_MEMBERS = [
  { name: '林知远', role: '所有者', email: 'zhiyuan@tensora.example', active: NOW - 2 * 60000 },
  { name: '周屿', role: '管理员', email: 'zhou.yu@tensora.example', active: NOW - 40 * 60000 },
  { name: '沈墨', role: '研究员', email: 'shenmo@tensora.example', active: NOW - 3 * HOUR },
  { name: '许嘉禾', role: '开发者', email: 'jiahe@tensora.example', active: NOW - 1 * DAY },
  { name: '陆青', role: '开发者', email: 'luqing@tensora.example', active: NOW - 5 * HOUR },
  { name: '何夕', role: '财务只读', email: 'hexi@tensora.example', active: NOW - 2 * DAY },
];

export const ROUTES_UPSTREAM = [
  { id: 'u1', name: '星枢 · 上海 H200', kind: 'self', share: 0.46, latency: 182, health: 'ok' },
  { id: 'u2', name: '星枢 · 乌兰察布', kind: 'self', share: 0.21, latency: 236, health: 'ok' },
  { id: 'u3', name: 'Aurion 上游', kind: 'ext', share: 0.18, latency: 410, health: 'ok' },
  { id: 'u4', name: 'Nebulos 上游', kind: 'ext', share: 0.09, latency: 298, health: 'warn' },
  { id: 'u5', name: 'Quillon / Veyra', kind: 'ext', share: 0.06, latency: 560, health: 'ok' },
];

export const REGIONS = [
  { id: 'cn-e', name: '华东', share: 0.38 },
  { id: 'cn-n', name: '华北', share: 0.24 },
  { id: 'cn-s', name: '华南', share: 0.21 },
  { id: 'sea', name: '东南亚', share: 0.11 },
  { id: 'eu', name: '欧洲', share: 0.06 },
];
