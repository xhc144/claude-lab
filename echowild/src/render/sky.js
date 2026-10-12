// Time-of-day palette: sun direction, sky gradient, light colour and fog, shared by the renderer,
// the HUD clock and the gameplay systems (mob spawning uses `daylight`).

import { clamp, smoothstep, lerp } from '../core/math.js';

export const DAY_TICKS = 24000; // one full day = 20 real minutes at 20 ticks/s

const C = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const DAY_Z = C('#3a7ed6'), DAY_H = C('#a6d2f3');
const SET_Z = C('#33447e'), SET_H = C('#f3a772');
const NIGHT_Z = C('#04060e'), NIGHT_H = C('#0d1730');
const RAIN_Z = C('#5d6773'), RAIN_H = C('#8a939d');
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function sunDirection(dayTime) {
  const a = (dayTime / DAY_TICKS) * Math.PI * 2;
  const x = Math.cos(a), y = Math.sin(a), z = 0.22;
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

// weather: { rain 0..1, storm 0..1 }, biome tweaks: { fog, sky } colours (hex) or null
export function skyState(dayTime, weather = { rain: 0, storm: 0 }, biome = null, flash = 0) {
  const sun = sunDirection(dayTime);
  const sy = sun[1];
  const daylight = smoothstep(-0.2, 0.22, sy);
  const night = 1 - smoothstep(-0.28, 0.02, sy);
  const tw = clamp(1 - Math.abs(sy + 0.04) / 0.32, 0, 1);
  const rain = weather.rain || 0, storm = weather.storm || 0;

  let zenith = mix3(NIGHT_Z, DAY_Z, daylight);
  let horizon = mix3(NIGHT_H, DAY_H, daylight);
  zenith = mix3(zenith, SET_Z, tw * 0.55);
  horizon = mix3(horizon, SET_H, tw * 0.8);
  if (biome && biome.sky) { const s = C(biome.sky); zenith = mix3(zenith, s, 0.25 * daylight); }
  const rainMix = rain * 0.75 + storm * 0.2;
  zenith = mix3(zenith, mix3(NIGHT_Z, RAIN_Z, daylight), rainMix);
  horizon = mix3(horizon, mix3(NIGHT_H, RAIN_H, daylight), rainMix);

  const sunGlow = [1.0 * tw + 0.08 * daylight, 0.55 * tw + 0.07 * daylight, 0.25 * tw + 0.05 * daylight].map((v) => v * (1 - rain * 0.8));
  const dl = daylight * (1 - rain * 0.3 - storm * 0.25);
  let skyColor = mix3([0.2, 0.235, 0.36], [1.0, 0.985, 0.95], dl);
  skyColor = mix3(skyColor, [1.0, 0.78, 0.6], tw * 0.35 * daylight);
  if (flash > 0) skyColor = mix3(skyColor, [1.6, 1.6, 1.8], flash);

  let fog = mix3(horizon, zenith, 0.18);
  if (biome && biome.fog) fog = mix3(fog, mix3(C(biome.fog), fog, 1 - daylight), 0.4);
  return { sun, daylight, night, twilight: tw, zenith, horizon, sunGlow, skyColor, fog, rain, storm };
}

export function clockString(dayTime) {
  // dayTime 0 = 06:00
  const h = ((dayTime / 1000 + 6) % 24);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
