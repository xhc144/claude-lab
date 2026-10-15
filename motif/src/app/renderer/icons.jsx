// UI icons come from the same Lucide set the engine ships for the `icon` component.
import ICONS from '../../generated/icons.json';

export const ICON_NAMES = Object.keys(ICONS);

export function Icon({ name, size = 16, stroke = 1.75, className, style, title }) {
  const d = ICONS[name] || ICONS['circle-question-mark'] || '';
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

/** Icon per component type / category for palettes, layers and the timeline. */
export const TYPE_ICON = {
  title: 'heading', text: 'pilcrow', bullets: 'list', quote: 'quote', callout: 'message-square-quote',
  stat: 'hash', stats: 'chart-no-axes-column', pictogram: 'users', chart: 'chart-column', table: 'table',
  timeline: 'git-commit-horizontal', steps: 'list-ordered', features: 'layout-grid', compare: 'columns-2', flow: 'workflow',
  hierarchy: 'network', matrix: 'grid-2x2', pyramid: 'triangle', image: 'image', gallery: 'images', icon: 'shapes',
  video: 'clapperboard', shape: 'square', code: 'code', equation: 'sigma', plot: 'chart-spline', geometry: 'triangle-right',
  transform: 'move-3d', vectorfield: 'wind', fourier: 'audio-waveform', simulation: 'atom', globe: 'globe', bars3d: 'box',
  surface: 'mountain', particles: 'sparkles', shape3d: 'box', model: 'boxes', molecule: 'atom', map: 'map',
};
export const CATEGORY_ICON = { text: 'type', data: 'chart-column', diagram: 'workflow', media: 'image', math: 'sigma', '3d': 'box' };
