// Component registry for the engine.
import textComps from './text.js';
import statComps from './stat.js';
import chartComps from './chart.js';
import diagramComps from './diagram.js';
import mediaComps from './media.js';
import mathComps from './math.js';
import threeComps from './three.js';

const REGISTRY = new Map();
export function register(list) { for (const c of list) REGISTRY.set(c.type, c); }
register([...textComps, ...statComps, ...chartComps, ...diagramComps, ...mediaComps, ...mathComps, ...threeComps]);

export function getComponent(type) { return REGISTRY.get(type); }
export function componentTypes() { return [...REGISTRY.keys()]; }

/** Fallback renderer for types not yet implemented in this build. */
export const placeholder = {
  type: '__placeholder',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.5), fill: true }; },
  build(block, c, rect) {
    return {
      duration: 0.6, hold: 1,
      issues: [{ level: 'warning', message: `块类型 ${block.type} 在当前版本中以占位符显示` }],
      draw(ctx, t) {
        const { p, env } = c;
        ctx.save();
        ctx.globalAlpha *= Math.min(1, t / 0.4);
        ctx.strokeStyle = p.softLine; ctx.setLineDash([8 * env.unit, 8 * env.unit]); ctx.lineWidth = 2 * env.unit;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = p.mutedText; ctx.font = `${env.sizes.small}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(block.type, rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.restore();
      },
    };
  },
};
