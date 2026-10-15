// Browser runtime bundle (dist/render.js): exposes the engine for the render worker, the HTML
// player and tests as window.Motif.
import { MotifEngine, settledTime } from './index.js';
import { normalizeDocument, validateDocument, summarizeDocument } from '../core/doc.js';
import { THEMES } from '../core/themes/index.js';
import { COMPONENTS } from '../core/catalog/components.js';
import { lintCompiled } from './lint.js';

globalThis.Motif = { lintCompiled, MotifEngine, normalizeDocument, validateDocument, summarizeDocument, settledTime, THEMES, COMPONENTS, version: '__VERSION__' };
