import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleZoom, viewport, project, ease, springProgress, normalizeZoom, planZooms,
  parsePointerTrack, CursorPath, FollowPath,
  normalizeClips, outDuration, outToSrc, srcToOut, srcRangeToOut, splitAt, cutRange, setSpeed, trimClip, audioSegments,
  screenSettings, screenRect, cameraRect,
} from '../../src/core/screen/index.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('easing curves start at 0, end at 1 and are monotone; the spring settles', () => {
  for (const e of ['linear', 'quad', 'cubic', 'quint', 'spring']) {
    near(ease(e, 0), 0); near(ease(e, 1), 1);
    let prev = -1;
    for (let i = 0; i <= 20; i++) { const v = ease(e, i / 20); assert.ok(v >= prev - 1e-6, `${e} monotone`); prev = v; }
  }
  near(springProgress(0.5), springProgress(0.5));
  assert.ok(springProgress(0.3) > 0.3, 'spring leads');
});

test('a zoom segment eases in, holds and eases out around its focus', () => {
  const z = [{ start: 1, end: 3, scale: 2, focus: [0.8, 0.2], easing: 'cubic', enter: 0.5, exit: 0.5, mode: 'manual' }];
  assert.equal(sampleZoom(z, 0.5).scale, 1);
  near(sampleZoom(z, 1.25).scale, 1 + ease('cubic', 0.5));
  assert.equal(sampleZoom(z, 2).scale, 2);
  near(sampleZoom(z, 3.25).scale, 2 - ease('cubic', 0.5));
  assert.equal(sampleZoom(z, 3.6).scale, 1);
  assert.deepEqual(sampleZoom(z, 2).focus, [0.8, 0.2]);
  // Fully zoomed, the picture still covers the frame (no empty border).
  const vp = viewport(sampleZoom(z, 2));
  const [x0, y0] = project(vp, 0, 0); const [x1, y1] = project(vp, 1, 1);
  assert.ok(x0 <= 1e-9 && y0 <= 1e-9 && x1 >= 1 - 1e-9 && y1 >= 1 - 1e-9);
  // The focus is framed inside the safe area.
  const [fx, fy] = project(vp, 0.8, 0.2);
  assert.ok(fx <= 0.7 + 1e-6 && fy >= 0.3 - 1e-6, `${fx},${fy}`);
});

test('touching segments hand off without a jump', () => {
  const z = [
    { start: 0, end: 2, scale: 2, focus: [0.3, 0.3], enter: 0.4, exit: 0, easing: 'linear', mode: 'manual' },
    { start: 2, end: 4, scale: 2.5, focus: [0.7, 0.7], enter: 0.4, exit: 0.4, easing: 'linear', mode: 'manual' },
  ];
  const a = viewport(sampleZoom(z, 2 - 1e-4));
  const b = viewport(sampleZoom(z, 2 + 1e-4));
  near(a.scale, b.scale, 0.01); near(a.tx, b.tx, 0.01); near(a.ty, b.ty, 0.01);
  near(sampleZoom(z, 2.4).scale, 2.5);
  assert.equal(normalizeZoom({ scale: 99 }).scale, 6);
});

test('auto zoom: nearby clicks form one shot, a long pause starts another; holds follow activity', () => {
  const ev = [];
  for (let t = 0; t <= 12; t += 0.05) if (t < 4 || t > 8.5) ev.push({ t, x: 0.3 + 0.0005 * t, y: 0.3, k: 0 });
  ev.push({ t: 2, x: 0.3, y: 0.3, k: 1 }, { t: 2.8, x: 0.32, y: 0.31, k: 1 }, { t: 9, x: 0.8, y: 0.7, k: 1 });
  ev.sort((a, b) => a.t - b.t);
  const z = planZooms(ev, { duration: 12 });
  assert.equal(z.length, 2);
  assert.ok(z[0].start < 2 && z[0].start > 1.8);
  assert.ok(z[0].end <= z[1].start, 'shots do not overlap');
  assert.ok(z[1].end <= 12);
  assert.ok(z.every((s) => s.mode === 'auto' && s.scale === 1.6));
  // Pointer kept moving after the clicks (until 4 s) → the first shot holds past the click hold.
  assert.ok(z[0].end > 4, `held to ${z[0].end}`);
});

test('cursor spring follows the track smoothly and passes exactly through clicks', () => {
  const ev = [[0, 0.1, 0.1, 0], [0.5, 0.1, 0.1, 0], [1, 0.9, 0.9, 0], [1.2, 0.9, 0.9, 1], [2, 0.9, 0.9, 0]];
  const tr = parsePointerTrack({ events: ev });
  const p = new CursorPath(tr);
  const c = p.at(1.2);
  near(c[0], 0.9, 1e-4); near(c[1], 0.9, 1e-4);
  const mid = p.at(0.75);
  assert.ok(mid[0] > 0.1 && mid[0] < 0.9);
  assert.equal(p.clickAt(1.3).kind, 'left');
  assert.equal(p.clickAt(2.5), null);
  assert.ok(p.idleFor(1.9) > 0.5);
  const raw = new CursorPath(tr, { smooth: 'raw' });
  near(raw.at(0.75)[0], 0.1, 1e-6, 'a long gap between samples means the pointer stood still');
  near(raw.at(1.1)[0], 0.9, 1e-6);
});

test('camera follow stays still inside the dead zone and glides when the cursor leaves it', () => {
  const ev = [];
  for (let t = 0; t <= 6; t += 0.02) ev.push([t, t < 3 ? 0.5 + 0.02 * Math.sin(t * 6) : 0.9, 0.5, 0]);
  const path = new CursorPath(parsePointerTrack({ events: ev }));
  const zooms = [normalizeZoom({ start: 0.5, end: 5.5, scale: 2, focus: [0.5, 0.5], mode: 'auto' })];
  const f = new FollowPath(path, zooms, { duration: 6 });
  near(f.at(2)[0], 0.5, 0.02);
  assert.ok(f.at(5)[0] > 0.6, `moved to ${f.at(5)[0]}`);
});

test('clips map output time to source time through cuts and speed changes', () => {
  let c = normalizeClips([], 10);
  assert.equal(outDuration(c), 10);
  c = splitAt(c, 4);
  assert.equal(c.length, 2);
  c = setSpeed(c, 1, 2); // 4..10 at 2× → 3 s
  near(outDuration(c), 7);
  near(outToSrc(c, 5).src, 6);
  near(srcToOut(c, 8), 6);
  c = cutRange(c, 1, 2); // drop source 1..2
  near(outDuration(c), 6);
  assert.equal(srcToOut(c, 1.5), null);
  near(outToSrc(c, 1).src, 2);
  assert.deepEqual(srcRangeToOut(c, 0.5, 2.5).map((r) => r.map((v) => +v.toFixed(3))), [[0.5, 1], [1, 1.5]]);
  c = trimClip(c, 0, 'from', 0.2, 10);
  near(c[0].from, 0.2);
  const a = audioSegments(c, 'mic.m4a', { volume: 0.5 });
  assert.equal(a.length, c.length);
  assert.equal(a.at(-1).tempo, 2);
});

test('settings, picture and camera rectangles', () => {
  const s = screenSettings({ padding: 0.1, camera_layout: { position: 'tl', size: 0.25 } });
  const r = screenRect(1920, 1080, 2560, 1440, s);
  near(r.w / r.h, 16 / 9, 0.01);
  assert.ok(r.x >= 108 - 1 && r.y >= 108 - 1);
  const cam = cameraRect(1920, 1080, s.camera, 1);
  assert.equal(cam.x, Math.round(1080 * 0.035));
  assert.ok(cameraRect(1920, 1080, s.camera, 2).w < cam.w, 'webcam shrinks when zoomed in');
  assert.equal(screenSettings({ cursor: { click: 'boom' } }).cursor.click, 'ripple');
  assert.deepEqual(screenSettings({}).motionBlur, { camera: 0.6, cursor: 0.5 });
  assert.deepEqual(screenSettings({ motionBlur: { camera: 5, cursor: 0 } }).motionBlur, { camera: 1, cursor: 0 });
});

test('a recording becomes one full-frame screen scene with planned zooms', async () => {
  const { recordingScene, isRecordingDoc } = await import('../../src/core/screen/index.js');
  const ev = [[0, 0.2, 0.2, 0], [1, 0.3, 0.3, 0], [1.2, 0.3, 0.3, 1], [1.3, 0.3, 0.3, 3], [2, 0.31, 0.3, 0]];
  const sc = recordingScene({ asset: 'a1', pointer: 'p1', mic: 'm1', width: 1920, height: 1080, duration: 6, fps: 60, track: { events: ev }, cursorInVideo: false }, { id: 's1', blockId: 'b1' });
  const b = sc.blocks[0];
  assert.equal(b.type, 'screen');
  assert.deepEqual(b.frame, { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(b.zooms.length, 1);
  assert.equal(b.source.cursorInVideo, false);
  assert.equal(sc.transition, 'cut');
  assert.ok(isRecordingDoc({ scenes: [sc] }));
  assert.ok(!isRecordingDoc({ scenes: [{ blocks: [{ type: 'title' }] }] }));
  const { normalizeDocument, validateDocument } = await import('../../src/core/doc.js');
  const doc = normalizeDocument({ title: 'r', assets: { a1: { id: 'a1', kind: 'video', file: 'a.mp4' }, p1: { id: 'p1', kind: 'data', file: 'p.json' }, m1: { id: 'm1', kind: 'audio', file: 'm.m4a' } }, scenes: [sc] }).doc;
  assert.equal(validateDocument(doc).filter((i) => i.level === 'error').length, 0);
  assert.equal(doc.scenes[0].blocks[0].type, 'screen');
});

test('export mixes the recording sound through cuts and speed changes', async () => {
  const { audioTracks, atempoChain, audioFilter, shiftAudio } = await import('../../src/app/main/ffmpeg.js');
  assert.deepEqual(atempoChain(1), []);
  assert.deepEqual(atempoChain(4), ['atempo=2', 'atempo=2']);
  assert.deepEqual(atempoChain(0.25), ['atempo=0.5', 'atempo=0.5']);
  assert.deepEqual(atempoChain(3), ['atempo=2', 'atempo=1.5']);
  const doc = {
    assets: { v: { file: 'assets/v.mp4' }, m: { file: 'assets/m.m4a' }, s: { file: 'assets/s.m4a' } },
    scenes: [
      { id: 'a', blocks: [{ type: 'title' }] },
      { id: 'b', blocks: [{ type: 'screen', asset: 'v', mic: 'm', system: 's', audio: { mic: 1.2, system: 0 }, source: { duration: 10 }, clips: [{ from: 0, to: 4 }, { from: 6, to: 10, speed: 2 }, { from: 4, to: 5, muted: true }] }] },
    ],
  };
  const tr = audioTracks(doc, '/p', [{ id: 'a', start: 0, duration: 3 }, { id: 'b', start: 3, duration: 7 }]);
  assert.equal(tr.length, 2, 'system at volume 0 and the muted clip are left out');
  assert.equal(tr[0].file, '/p/assets/m.m4a'.replace(/\//g, (await import('node:path')).sep));
  assert.equal(tr[0].start, 3);
  assert.equal(tr[1].start, 7);
  assert.equal(tr[1].tempo, 2);
  assert.equal(tr[0].volume, 1.2);
  assert.match(audioFilter(tr[1], 10), /^atrim=6:10,asetpts=PTS-STARTPTS,atempo=2,volume=1\.2,adelay=7000\|7000$/);
  // range export from t=5: the first segment is trimmed at its head, the second slides back
  const sh = shiftAudio(tr, 5);
  assert.equal(sh.length, 2);
  assert.equal(sh[0].start, 0);
  assert.equal(sh[0].trim[0], 2, 'starts 2 s into the source (3 + 2 = 5)');
  assert.equal(sh[1].start, 2);
  // from t=8 the first segment (output 3–7) is gone; speed 2: one output second is two source seconds
  const late = shiftAudio(tr, 8);
  assert.equal(late.length, 1);
  assert.equal(late[0].trim[0], 6 + 2);
  // a scene shorter than the recording cuts the audio at the scene end
  const short = audioTracks(doc, '/p', [{ id: 'a', start: 0, duration: 3 }, { id: 'b', start: 3, duration: 2 }]);
  assert.equal(short.length, 1);
  assert.equal(short[0].trim[1], 2);
});
