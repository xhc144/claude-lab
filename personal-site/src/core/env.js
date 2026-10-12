// Environment & quality tier. Override with ?q=low|mid|high, skip the boot with ?skip.
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
const params = new URLSearchParams(location.search);

export const env = {
  params,
  reducedMotion: mq('(prefers-reduced-motion: reduce)'),
  coarse: mq('(pointer: coarse)'),
  narrow: mq('(max-width: 860px)'),
  file: location.protocol === 'file:',
};

function detectQuality() {
  const forced = params.get('q');
  if (forced === 'low' || forced === 'mid' || forced === 'high') return forced;
  if (env.reducedMotion || env.coarse || env.narrow) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  return cores >= 8 && mem >= 8 ? 'high' : 'mid';
}
env.quality = detectQuality();
env.particles = { high: 65536, mid: 49152, low: 24576 }[env.quality];
env.pixelRatio = Math.min(window.devicePixelRatio || 1, env.quality === 'high' ? 1.75 : env.quality === 'mid' ? 1.4 : 1.25);
