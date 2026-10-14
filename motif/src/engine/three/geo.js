// Geographic helpers: land dot sampling from Natural Earth (world-atlas 110m) and a city gazetteer.
import WORLD from '../../generated/world.json';
import { feature } from 'topojson-client';

let landPolys = null;
function polys() {
  if (landPolys) return landPolys;
  const fc = feature(WORLD, WORLD.objects.land);
  landPolys = [];
  for (const f of fc.features) {
    const g = f.geometry;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of list) {
      const ring = poly[0];
      let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
      for (const [x, y] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      landPolys.push({ rings: poly, bbox: [x0, y0, x1, y1] });
    }
  }
  return landPolys;
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isLand(lon, lat) {
  for (const p of polys()) {
    const b = p.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (inRing(lon, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(lon, lat, h))) return true;
  }
  return false;
}

const dotCache = new Map();
/** Evenly distributed land points (lat/lon) at roughly `stepDeg` spacing. */
export function landDots(stepDeg = 1.6) {
  if (dotCache.has(stepDeg)) return dotCache.get(stepDeg);
  const out = [];
  for (let lat = -84; lat <= 84; lat += stepDeg) {
    const n = Math.max(1, Math.round((360 / stepDeg) * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < n; i++) {
      const lon = -180 + (i + 0.5) * (360 / n);
      if (isLand(lon, lat)) out.push([lat, lon]);
    }
  }
  dotCache.set(stepDeg, out);
  return out;
}

export const CITIES = {
  北京: [39.9, 116.4], Beijing: [39.9, 116.4], 上海: [31.23, 121.47], Shanghai: [31.23, 121.47], 深圳: [22.54, 114.06], Shenzhen: [22.54, 114.06],
  广州: [23.13, 113.26], Guangzhou: [23.13, 113.26], 杭州: [30.27, 120.15], Hangzhou: [30.27, 120.15], 成都: [30.57, 104.07], Chengdu: [30.57, 104.07],
  重庆: [29.56, 106.55], 武汉: [30.59, 114.31], 西安: [34.34, 108.94], 南京: [32.06, 118.8], 天津: [39.13, 117.2], 苏州: [31.3, 120.62],
  香港: [22.32, 114.17], 'Hong Kong': [22.32, 114.17], 台北: [25.03, 121.57], Taipei: [25.03, 121.57], 澳门: [22.2, 113.55],
  东京: [35.68, 139.69], Tokyo: [35.68, 139.69], 大阪: [34.69, 135.5], Osaka: [34.69, 135.5], 首尔: [37.57, 126.98], Seoul: [37.57, 126.98],
  新加坡: [1.35, 103.82], Singapore: [1.35, 103.82], 曼谷: [13.76, 100.5], Bangkok: [13.76, 100.5], 雅加达: [-6.2, 106.85], Jakarta: [-6.2, 106.85],
  吉隆坡: [3.14, 101.69], 'Kuala Lumpur': [3.14, 101.69], 马尼拉: [14.6, 120.98], Manila: [14.6, 120.98], 河内: [21.03, 105.85], 胡志明市: [10.82, 106.63],
  孟买: [19.08, 72.88], Mumbai: [19.08, 72.88], 新德里: [28.61, 77.21], 'New Delhi': [28.61, 77.21], 班加罗尔: [12.97, 77.59], Bangalore: [12.97, 77.59],
  迪拜: [25.2, 55.27], Dubai: [25.2, 55.27], 利雅得: [24.71, 46.68], Riyadh: [24.71, 46.68], 伊斯坦布尔: [41.01, 28.98], Istanbul: [41.01, 28.98], 德黑兰: [35.69, 51.39],
  莫斯科: [55.76, 37.62], Moscow: [55.76, 37.62], 伦敦: [51.51, -0.13], London: [51.51, -0.13], 巴黎: [48.86, 2.35], Paris: [48.86, 2.35],
  柏林: [52.52, 13.4], Berlin: [52.52, 13.4], 慕尼黑: [48.14, 11.58], Munich: [48.14, 11.58], 法兰克福: [50.11, 8.68], Frankfurt: [50.11, 8.68],
  阿姆斯特丹: [52.37, 4.9], Amsterdam: [52.37, 4.9], 马德里: [40.42, -3.7], Madrid: [40.42, -3.7], 罗马: [41.9, 12.5], Rome: [41.9, 12.5], 米兰: [45.46, 9.19], Milan: [45.46, 9.19],
  苏黎世: [47.38, 8.54], Zurich: [47.38, 8.54], 维也纳: [48.21, 16.37], Vienna: [48.21, 16.37], 斯德哥尔摩: [59.33, 18.07], Stockholm: [59.33, 18.07], 华沙: [52.23, 21.01],
  纽约: [40.71, -74.01], 'New York': [40.71, -74.01], 洛杉矶: [34.05, -118.24], 'Los Angeles': [34.05, -118.24], 旧金山: [37.77, -122.42], 'San Francisco': [37.77, -122.42],
  西雅图: [47.61, -122.33], Seattle: [47.61, -122.33], 芝加哥: [41.88, -87.63], Chicago: [41.88, -87.63], 波士顿: [42.36, -71.06], Boston: [42.36, -71.06],
  华盛顿: [38.91, -77.04], Washington: [38.91, -77.04], 迈阿密: [25.76, -80.19], Miami: [25.76, -80.19], 达拉斯: [32.78, -96.8], 奥斯汀: [30.27, -97.74], Austin: [30.27, -97.74],
  多伦多: [43.65, -79.38], Toronto: [43.65, -79.38], 温哥华: [49.28, -123.12], Vancouver: [49.28, -123.12], 墨西哥城: [19.43, -99.13], 'Mexico City': [19.43, -99.13],
  圣保罗: [-23.55, -46.63], 'São Paulo': [-23.55, -46.63], 'Sao Paulo': [-23.55, -46.63], 里约热内卢: [-22.91, -43.17], 布宜诺斯艾利斯: [-34.6, -58.38], 'Buenos Aires': [-34.6, -58.38],
  圣地亚哥: [-33.45, -70.67], 利马: [-12.05, -77.04], 波哥大: [4.71, -74.07], 开罗: [30.04, 31.24], Cairo: [30.04, 31.24], 拉各斯: [6.52, 3.38], Lagos: [6.52, 3.38],
  内罗毕: [-1.29, 36.82], Nairobi: [-1.29, 36.82], 约翰内斯堡: [-26.2, 28.05], Johannesburg: [-26.2, 28.05], 开普敦: [-33.92, 18.42], 'Cape Town': [-33.92, 18.42],
  悉尼: [-33.87, 151.21], Sydney: [-33.87, 151.21], 墨尔本: [-37.81, 144.96], Melbourne: [-37.81, 144.96], 奥克兰: [-36.85, 174.76], Auckland: [-36.85, 174.76],
  乌鲁木齐: [43.83, 87.62], 拉萨: [29.65, 91.13], 哈尔滨: [45.8, 126.53], 昆明: [25.04, 102.71], 厦门: [24.48, 118.09], 青岛: [36.07, 120.38], 长沙: [28.23, 112.94], 郑州: [34.75, 113.62],
};

/** Accepts [lat, lon], {lat, lon}, or a city name. */
export function toLatLon(v) {
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number') return [v[0], v[1]];
  if (v && typeof v === 'object' && typeof v.lat === 'number') return [v.lat, v.lon ?? v.lng ?? 0];
  if (typeof v === 'string' && CITIES[v.trim()]) return CITIES[v.trim()];
  if (v && typeof v === 'object' && (v.city || v.name || v.label) && CITIES[v.city || v.name || v.label]) return CITIES[v.city || v.name || v.label];
  return null;
}
