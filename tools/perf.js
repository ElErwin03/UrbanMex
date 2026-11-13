#!/usr/bin/env node
/* Perfilador sin GDevelop: ejecuta las escenas del proyecto GENERADO sobre un motor simulado que CUENTA lo que el juego le pide en cada fotograma.
 *   node tools/perf.js [carpeta-del-repo] [--frames N] [--lang en] [--mobile] [--json] [--marks]
 * Por escena muestra: ms de JS por fotograma, objetos creados, llamadas al motor por fotograma y cuántas son REDUNDANTES (mismo valor que ya tenía
 * ese objeto: en GDevelop, p. ej., TextObject.setColor / setText vuelven a armar el texto aunque no cambie), comandos de dibujo de los
 * "Dibujantes" por fotograma y cuántos fotogramas redibujaron algo idéntico al anterior. También mide el crecimiento de memoria en una sesión larga.
 * No mide el costo de PIXI/WebGL (eso solo se ve en GDevelop), pero sí todo lo que el juego le manda hacer. */
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] === undefined || args[i + 1].startsWith('--') ? true : args[i + 1]); };
const ROOT = path.resolve(args.find((a) => !a.startsWith('--') && fs.existsSync(a)) || '.'), PROJ = path.join(ROOT, 'My project');
const project = JSON.parse(fs.readFileSync(path.join(PROJ, 'UrbanMex.json'), 'utf8')), res = {}; project.resources.resources.forEach((r) => { res[r.name] = r; });
const FRAMES = +flag('frames', 300), SETTERS = ['setText', 'setColor', 'setOpacity', 'setZOrder', 'setPosition', 'setX', 'setY', 'hide', 'setScale', 'setScaleX', 'setScaleY', 'setAnimationName', 'setCharacterSize', 'setLayer', 'setAngle', 'setBlendMode', 'setFontName'];
const DRAW = ['drawRectangle', 'drawCircle', 'drawEllipse', 'drawLineV2', 'beginFillPath', 'drawPathLineTo', 'closePath', 'endFillPath', 'clear'];
let C;                                                          // contadores del fotograma actual / acumulados
const reset = () => { C = { calls: 0, redundant: 0, byMethod: {}, redByMethod: {}, draws: 0, frames: 0, painterFrames: 0, painterSame: 0 }; };

function mock(def, scene) {
  const last = {}, sig = { cur: [], prev: [] }, o = { def, hiddenNow: false };
  const noop = () => 0;
  return new Proxy(o, { get(t, k) {
    if (typeof k === 'symbol' || k === 'then') return undefined; if (k in t || k.startsWith('_um')) return t[k];
    return (...a) => {
      C.calls++; C.byMethod[k] = (C.byMethod[k] || 0) + 1;
      if (SETTERS.includes(k)) { const v = JSON.stringify(a); if (last[k] === v) { C.redundant++; C.redByMethod[k] = (C.redByMethod[k] || 0) + 1; } last[k] = v; }
      if (DRAW.includes(k)) { C.draws++; if (k === 'clear') { t.sigPrev = t.sigCur; t.sigCur = []; if (t.sigPrev) { C.painterFrames++; t._pend = true; } } else (t.sigCur = t.sigCur || []).push(k + JSON.stringify(a)); }
      if (k === 'getX') return t.x || 0; if (k === 'getY') return t.y || 0; if (k === 'getWidth' || k === 'getHeight') return 32;
      if (k === 'setPosition') { t.x = a[0]; t.y = a[1]; } return undefined;
    };
  } });
}
function endFrameSame(scene) { scene.objects.forEach((o) => { if (o._pend !== undefined && o.sigPrev !== undefined) { o._pend = false; } }); }

const cams = {};
function makeScene(layout, input, json) {
  const layers = layout.layers.map((l) => l.name);
  const lay = (n) => cams[layout.name + n] = cams[layout.name + n] || { x: 640, y: 360, zoom: 1, setCameraX(v) { this.x = v; }, setCameraY(v) { this.y = v; }, setCameraZoom(v) { this.zoom = v; }, convertCoords(x, y, c, r) { return [(x - 640) / this.zoom + this.x, (y - 360) / this.zoom + this.y]; } };
  const snd = new Proxy({}, { get: () => () => ({ setVolume() { return this; }, fade() {}, stop() {}, playing: () => false }) });
  const scene = { changes: [], objects: [], createObject(n) { const d = layout.objects.find((x) => x.name === n); if (!d) throw new Error(n); const o = mock(d, scene); scene.objects.push(o); return o; }, getLayer: lay, getElapsedTime: () => 16, requestChange(c, n) { scene.changes.push([c, n]); },
    getGame: () => ({ getInputManager: () => input, getJsonManager: () => json, getSoundManager: () => snd }) };
  return scene;
}
const input = { x: 640, y: 360, down: false, rel: false, wheel: 0, getCursorX() { return input.x; }, getCursorY() { return input.y; }, isMouseButtonPressed: () => input.down, isMouseButtonReleased: () => input.rel, getMouseWheelDelta: () => input.wheel, getAllTouchIdentifiers: () => [], getTouchX: () => 0, getTouchY: () => 0 };
const jsonMgr = { getLoadedJson(n) { return JSON.parse(fs.readFileSync(path.join(PROJ, res[n].file), 'utf8')); }, isJsonLoaded: () => true, loadJson() {} };
globalThis.gdjs = { SceneChangeRequest: { CONTINUE: 0, PUSH_SCENE: 1, POP_SCENE: 2, REPLACE_SCENE: 3, CLEAR_SCENES: 4, STOP_GAME: 5 }, evtTools: { input: { wasKeyReleased: () => false } } };
const ext = {}; project.externalEvents.forEach((e) => { ext[e.name] = e.events.filter((x) => x.type.endsWith('JsCode')).map((x) => new Function('runtimeScene', 'eventsFunctionContext', x.inlineCode.join('\n'))); });
const U = () => globalThis.gdjs.UrbanMex;
function runner(layout) { const compiled = layout.events.map((ev) => ev.type.endsWith('Link') ? ext[ev.target] : ev.type.endsWith('JsCode') ? [new Function('runtimeScene', 'eventsFunctionContext', ev.inlineCode.join('\n'))] : []); return (scene) => compiled.forEach((fs_) => fs_.forEach((f) => f(scene, {}))); }
function open(name) { const layout = project.layouts.find((l) => l.name === name), scene = makeScene(layout, input, jsonMgr), run = runner(layout); return { scene, layout, frame: () => { run(scene); input.rel = false; input.wheel = 0; }, click(x, y) { input.x = x; input.y = y; input.down = true; run(scene); input.down = false; input.rel = true; run(scene); input.rel = false; } }; }

const rows = [];
function bench(label, setup, step, frames) {
  reset(); const s = setup(); const t0 = process.hrtime.bigint(); const n = frames || FRAMES;
  for (let i = 0; i < n; i++) { if (step) step(s, i); s.frame(); C.frames++; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  const objs = s.scene.objects.length, painters = s.scene.objects.filter((o) => o.def && o.def.type === 'PrimitiveDrawing::Drawer');
  // fotogramas en que un Dibujante repintó EXACTAMENTE lo mismo que el anterior (trabajo perdido para PIXI)
  rows.push({ label, ms: +ms.toFixed(3), objs, calls: Math.round(C.calls / n), redundant: Math.round(C.redundant / n), pctRed: +(100 * C.redundant / Math.max(1, C.calls)).toFixed(0), draws: Math.round(C.draws / n), top: Object.entries(C.redByMethod).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + Math.round(v / n)).join(', ') });
  return s;
}
const prep = () => { const g = globalThis.gdjs; delete g.UrbanMex; };
const setSession = (f) => (s) => { s.frame(); const u = U(); u.session.completed = [0, 1, 2]; u.session.loaded = true; if (flag('lang')) u.session.lang = flag('lang'); if (flag('mobile')) u.session.uiMode = 'on'; if (f) f(u, s); return s; };
const M = (v) => (u, s) => { s.frame(); s.scene._um.view = v; };
prep(); bench('Menú principal', () => setSession()(open('Menu')), null);
prep(); bench('Menú · seleccionar nivel', () => { const s = setSession()(open('Menu')); s.frame(); s.scene._um.view = 'levels'; return s; }, null);
prep(); bench('Menú · más modos', () => { const s = setSession()(open('Menu')); s.frame(); s.scene._um.view = 'modes'; return s; }, null);
prep(); bench('Nivel · inicio (aviso)', () => { const s = setSession((u) => { u.session.levelIndex = 0; })(open('Nivel')); delete s.scene._um; s.frame(); return s; }, null);
prep(); bench('Nivel · mapa quieto', () => { const s = setSession((u) => { u.session.levelIndex = 3; })(open('Nivel')); delete s.scene._um; s.frame(); s.scene._um.modal = null; return s; }, null);
prep(); bench('Nivel · mapa con el puntero moviéndose', () => { const s = setSession((u) => { u.session.levelIndex = 3; })(open('Nivel')); delete s.scene._um; s.frame(); s.scene._um.modal = null; return s; }, (s, i) => { input.x = 200 + (i * 7) % 900; input.y = 150 + (i * 5) % 450; });
prep(); bench('Nivel · celular abierto', () => { const s = setSession((u) => { u.session.levelIndex = 3; })(open('Nivel')); delete s.scene._um; s.frame(); s.scene._um.modal = null; s.scene._um.phoneOpen = true; return s; }, null);
prep(); bench('Resultado', () => { const s = setSession((u) => { u.session.lastResult = { won: true, levelIndex: 2, day: 'MARTES', arrival: '9:00 AM', travelTime: '2h 00m', steps: 14, money: 60, robbed: 0, stolen: 0, newsRead: 5, reason: '', cause: '', moneyStart: 150, currency: 'peje-coins', stars: 3, moneyGoal: 56, got: { arrive: true, saver: true, safe: true }, hops: 12, left: 0, progress: 1, record: null }; })(open('Resultado')); return s; }, null);
prep(); bench('Tutorial', () => setSession()(open('Tutorial')), null);

// memoria en una sesión larga del Nivel (fugas): 4000 fotogramas con el puntero moviéndose
function mem() {
  prep(); reset(); const s = setSession((u) => { u.session.levelIndex = 3; })(open('Nivel')); delete s.scene._um; s.frame(); s.scene._um.modal = null;
  global.gc && global.gc(); const h0 = process.memoryUsage().heapUsed, o0 = s.scene.objects.length;
  const marks = [];
  mem.marks = marks;
  for (let i = 0; i < 4000; i++) { input.x = 200 + (i * 7) % 900; input.y = 150 + (i * 5) % 450; s.frame(); if (i === 499 || i === 1999 || i === 3999) marks.push(s.scene.objects.length - o0); }
  if (flag('marks')) console.log('objetos nuevos tras 500/2000/4000 fotogramas:', marks.join(' / '));
  mem.leak = marks[2] > marks[1];                                  // se estabilizan (pools de partículas y rótulos) = sin fuga; si siguen creciendo, sí
  global.gc && global.gc(); return { heapMB: +((process.memoryUsage().heapUsed - h0) / 1048576).toFixed(2), objects: s.scene.objects.length - o0 };
}
const m = mem();
if (flag('json')) console.log(JSON.stringify({ rows, mem: m })); else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('escena', 40) + pad('ms/fot', 9) + pad('objetos', 9) + pad('llamadas', 10) + pad('redundantes', 13) + pad('%', 5) + pad('dibujos', 9) + 'más redundantes');
  rows.forEach((r) => console.log(pad(r.label, 40) + pad(r.ms, 9) + pad(r.objs, 9) + pad(r.calls, 10) + pad(r.redundant, 13) + pad(r.pctRed, 5) + pad(r.draws, 9) + r.top));
  console.log('\nsesión larga (4000 fotogramas en el Nivel): memoria +' + m.heapMB + ' MB, objetos nuevos en la escena: ' + m.objects + (mem.leak ? ' (¡siguen creciendo: fuga!)' : ' (se estabilizan: sin fugas de objetos)'));
}
