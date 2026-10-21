// A recording as a Motif scene: one full-frame `screen` block with the automatic camera planned
// from the clicks. Shared by the recorder (desktop app) and the CLI.
import { planZooms } from './planner.js';
import { parsePointerTrack } from './cursor.js';

/**
 * rec: { asset, pointer?, camera?, mic?, system?, width, height, duration, fps, cursorInVideo,
 *        cameraOffset?, track? (pointer JSON, for planning), autoZoom = true, style? }
 */
export function recordingScene(rec, { id, blockId } = {}) {
  const track = rec.track ? parsePointerTrack(rec.track) : null;
  const zooms = rec.autoZoom !== false && track?.events.length ? planZooms(track.events, { duration: rec.duration }) : [];
  const block = {
    id: blockId, type: 'screen', asset: rec.asset,
    ...(rec.pointer ? { pointer: rec.pointer } : {}),
    ...(rec.camera ? { camera: rec.camera } : {}),
    ...(rec.mic ? { mic: rec.mic } : {}),
    ...(rec.system ? { system: rec.system } : {}),
    source: {
      width: rec.width, height: rec.height, duration: rec.duration, fps: rec.fps || 30,
      cursorInVideo: rec.cursorInVideo !== false,
      ...(rec.cameraOffset ? { cameraOffset: rec.cameraOffset } : {}),
    },
    clips: [{ id: 'c1', from: 0, to: rec.duration, speed: 1 }],
    zooms,
    frame: { x: 0, y: 0, w: 1, h: 1 },
    ...(rec.style || {}),
  };
  if (!block.id) delete block.id;
  return { ...(id ? { id } : {}), name: rec.name || '录屏', layout: 'auto', duration: 'auto', transition: 'cut', camera: { type: 'none' }, blocks: [block] };
}

/** The screen block of a scene (or of the first scene holding one). */
export function screenBlockOf(doc, sceneId) {
  for (const s of doc.scenes || []) {
    if (sceneId && s.id !== sceneId) continue;
    const b = s.blocks.find((x) => x.type === 'screen');
    if (b) return { scene: s, block: b };
  }
  return null;
}

/** Whether a document is (mainly) a screen recording: opened in the recording editor. */
export function isRecordingDoc(doc) {
  if (doc?.meta?.kind === 'recording') return true;
  return !!doc?.scenes?.length && doc.scenes.every((s) => s.blocks.some((b) => b.type === 'screen'));
}
