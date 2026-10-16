// Shared state of the recording editor: the recording being edited and its pointer track.
import { useMemo } from 'react';
import { editor, useEditor } from '../editor/store.js';
import { screenBlockOf, screenSettings, normalizeClips, outDuration, sortZooms, parsePointerTrack } from '../../../core/screen/index.js';

/** The recording being edited: its scene, block, clips, zooms and timing. */
export function useRec() {
  const doc = useEditor((s) => s.doc);
  const selScene = useEditor((s) => s.sel.scene);
  const timing = useEditor((s) => s.timing);
  return useMemo(() => {
    if (!doc) return null;
    const found = screenBlockOf(doc, selScene) || screenBlockOf(doc);
    if (!found) return null;
    const { scene, block } = found;
    const sc = timing.scenes.find((x) => x.id === scene.id);
    const D = Number(block.source?.duration) || 0;
    const clips = normalizeClips(block.clips, D);
    return {
      doc, scene, block, D, clips, zooms: sortZooms(block.zooms), settings: screenSettings(block),
      start: sc?.start || 0, length: outDuration(clips), sceneDur: sc?.duration || outDuration(clips),
      scenes: doc.scenes.filter((s) => s.blocks.some((b) => b.type === 'screen')),
    };
  }, [doc, selScene, timing]);
}

export function setBlock(rec, set, o = {}) {
  return editor.updateBlock(rec.block.id, set, { message: o.message || '编辑录屏', coalesce: o.coalesce, ...o });
}

/** Pointer track of the recording (loaded by the engine). */
export function usePointer(rec) {
  useEditor((s) => s.frame); // re-read once the engine has loaded the track
  const assets = editor.engine?.assets;
  const url = rec?.block.pointer && assets ? assets.urlFor(rec.block.pointer) : null;
  const entry = url ? assets.extra.get('ptr:' + url) : null;
  const value = entry?.done && !entry.error ? entry.value : null;
  return useMemo(() => (value ? parsePointerTrack(value) : null), [value]);
}

