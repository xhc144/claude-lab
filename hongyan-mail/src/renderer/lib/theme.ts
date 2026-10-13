import type { Settings } from '@shared/types';
import { api } from '../api';

/** Applies theme / accent / density to <html>; returns whether the dark palette is active. */
export function applyTheme(s: Settings): boolean {
  const dark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = s.accent;
  root.dataset.density = s.density;
  root.dataset.mica = s.mica ? 'on' : 'off';
  api.setTitleBarColors({ color: '#00000000', symbolColor: dark ? '#eeeae3' : '#1c1a17' }).catch(() => {});
  return dark;
}
