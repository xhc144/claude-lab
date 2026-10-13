// World statistics sampled through time, for the charts: climate, life, civilisation. When a
// series gets long it is thinned (every other sample dropped) so memory stays bounded however long
// the world runs.

import { year } from './state.js';

export const SERIES = {
  temp: { name: '全球气温距平', unit: '°C' },
  co2: { name: '二氧化碳', unit: 'ppm' },
  sea: { name: '海平面', unit: 'm' },
  creatures: { name: '野生动物', unit: '' },
  species: { name: '现存物种', unit: '' },
  pop: { name: '文明人口', unit: '' },
  nations: { name: '国家数', unit: '' },
  cities: { name: '城市数', unit: '' },
  wars: { name: '进行中的战争', unit: '' },
  era: { name: '最先进时代', unit: '' },
  faith: { name: '你的信徒', unit: '' },
  veg: { name: '植被覆盖', unit: '' },
};

const MAX = 1200;

export function initStats(w) {
  w.series = { t: [] };
  for (const k in SERIES) w.series[k] = [];
  w.seriesEvery = 1;
}

export function sampleStats(w) {
  const s = w.series;
  if (!s) return;
  if (year(w) % w.seriesEvery !== 0) return;
  let pop = 0, cities = 0, era = 0, nations = 0;
  for (const n of w.nations) {
    if (!n.alive || !n.cities.length) continue;
    nations++;
    pop += n.stats.pop;
    cities += n.cities.length;
    era = Math.max(era, n.era);
  }
  let faith = 0;
  for (const r of w.religions) if (r.alive && r.player) faith += r.followers;
  s.t.push(year(w));
  s.temp.push(+w.climate.offset.toFixed(2));
  s.co2.push(Math.round(w.climate.co2));
  s.sea.push(Math.round((w.seaLevel - w.seaLevelBase0) * 6000));
  s.creatures.push(w.life.count);
  s.species.push(w.speciesAliveCount);
  s.pop.push(Math.round(pop));
  s.nations.push(nations);
  s.cities.push(cities);
  s.wars.push(w.activeWars || 0);
  s.era.push(era);
  s.faith.push(Math.round(faith));
  s.veg.push(+(w.stats.vegMean || 0).toFixed(3));
  if (s.t.length > MAX) {
    for (const k in s) s[k] = s[k].filter((_, i) => i % 2 === 0);
    w.seriesEvery *= 2;
  }
}
