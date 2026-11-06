// Prueba de humo: ejecuta el proyecto GENERADO ("My project/UrbanMex.json") sobre un motor simulado y estricto.
// El simulado solo permite métodos del runtime de GDevelop verificados contra su código fuente, valida nombres de
// objetos/animaciones/capas/recursos y rechaza NaN o colores mal formados. Juega una semana completa con un bot.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { ROOT, DATA, cheapestStaminaPath } = require('./helpers');
const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'My project', 'UrbanMex.json'), 'utf8'));
const resNames = {}; project.resources.resources.forEach((r) => { resNames[r.name] = r; });
const fileOf = (n) => path.join(ROOT, 'My project', resNames[n].file);

const ALLOWED = {
  common: ['setLayer', 'setPosition', 'setX', 'setY', 'getX', 'getY', 'setZOrder', 'hide', 'setOpacity', 'getWidth', 'getHeight', 'deleteFromScene'],
  Sprite: ['setAnimationName', 'setScale', 'setColor', 'setScaleX', 'setScaleY', 'setAngle', 'setBlendMode'],   // verificados en spriteruntimeobject.ts
  'TextObject::Text': ['setText', 'setCharacterSize', 'setColor', 'setFontName'],
  'PrimitiveDrawing::Drawer': ['clear', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawLineV2', 'setFillColor', 'setFillOpacity',
    'setOutlineColor', 'setOutlineOpacity', 'setOutlineSize', 'setCoordinatesRelative',
    'beginFillPath', 'drawPathLineTo', 'closePath', 'endFillPath']   // trazados de relleno (isométrico): verificados en shapepainterruntimeobject.ts
};
const COLOR_FN = ['setColor', 'setFillColor', 'setOutlineColor'];
let stats = { calls: 0 };

function mockObject(def) {
  const allowed = new Set(ALLOWED.common.concat(ALLOWED[def.type] || [])), state = { x: 0, y: 0, hidden: false, anim: null, name: def.name };
  const anims = def.type === 'Sprite' ? def.animations.map((a) => a.name) : null;
  return new Proxy(state, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'symbol' || k === 'then' || k.startsWith('_um')) return t[k];
    assert.ok(allowed.has(k), `${def.name} (${def.type}) no tiene el método "${k}" en el runtime`);
    return (...args) => {
      stats.calls++;
      args.forEach((a) => { if (typeof a === 'number') assert.ok(Number.isFinite(a), `${def.name}.${k}: argumento no numérico ${a}`); });
      if (COLOR_FN.includes(k)) assert.match(args[0], /^\d{1,3};\d{1,3};\d{1,3}$/, `${def.name}.${k}: color inválido ${args[0]}`);
      if (k === 'setAnimationName') { assert.ok(anims.includes(args[0]), `${def.name}: animación inexistente "${args[0]}"`); t.anim = args[0]; }
      if (k === 'setFontName') assert.equal(resNames[args[0]] && resNames[args[0]].kind, 'font', 'fuente no declarada: ' + args[0]);
      if (k === 'setLayer') t.layer = args[0];
      if (k === 'setOpacity') { assert.ok(args[0] >= 0 && args[0] <= 255, `${def.name}.setOpacity fuera de rango: ${args[0]}`); t.opacity = args[0]; }
      if (k === 'setBlendMode') { assert.ok([0, 1, 2, 3].includes(args[0]), 'modo de mezcla inválido ' + args[0]); t.blend = args[0]; }
      if (k === 'setScaleX') t.sx = args[0];
      if (k === 'setScaleY') t.sy = args[0];
      if (k === 'setZOrder') t.z = args[0];
      if (k === 'setPosition') { t.x = args[0]; t.y = args[1]; }
      if (k === 'setX') t.x = args[0];
      if (k === 'setY') t.y = args[0];
      if (k === 'hide') t.hidden = args[0] !== false;
      if (k === 'getX') return t.x; if (k === 'getY') return t.y;
      if (k === 'getWidth' || k === 'getHeight') return 32;
    };
  } });
}

// Administrador de sonido simulado y ESTRICTO: solo los métodos de GDevelop verificados en howler-sound-manager.ts; cada nombre debe ser un
// recurso de audio declarado en el proyecto, los volúmenes van de 0 a 100 (de 0 a 1 en fade) y la música debe ir en bucle.
const audioCheck = (n) => { assert.ok(resNames[n] && resNames[n].kind === 'audio', 'recurso de audio no declarado: ' + n); assert.ok(fs.existsSync(fileOf(n)), 'falta el archivo de ' + n); };
const SND = { log: [], music: {}, gv: 100,
  reset() { this.log = []; this.music = {}; this.gv = 100; },
  playSound(n, loop, v, p) { audioCheck(n); assert.equal(loop, false); assert.ok(v >= 0 && v <= 100 && p === 1, 'volumen/tono de ' + n); this.log.push({ k: 'sound', n, v }); },
  playMusicOnChannel(n, ch, loop, v, p) {
    audioCheck(n); assert.equal(loop, true, 'la música va en bucle'); assert.ok(v >= 0 && v <= 100 && [0, 1, 2].includes(ch));
    if (this.music[ch]) this.music[ch].stopped = true;
    this.music[ch] = { n, ch, stopped: false, vol: v / 100, fades: [], setVolume(x) { assert.ok(typeof x === 'number' && x >= 0 && x <= 1, 'setVolume 0..1: ' + x); this.vol = x; return this; }, fade(a, b, d) { assert.ok(a >= 0 && a <= 1 && b >= 0 && b <= 1 && d > 0); this.fades.push([a, b, d]); return this; }, stop() { this.stopped = true; return this; } };
    this.log.push({ k: 'music', n, ch, v });
  },
  getMusicOnChannel(ch) { return this.music[ch] || null; },
  setGlobalVolume(v) { assert.ok(v >= 0 && v <= 100); this.gv = v; },
  count(re) { return this.log.filter((e) => re.test(e.n)).length; } };

function makeScene(layout, input, json) {
  const layers = layout.layers.map((l) => l.name), cams = {};
  const mkLayer = (n) => cams[n] = cams[n] || { x: 640, y: 360, zoom: 1, setCameraX(v) { assert.ok(Number.isFinite(v)); this.x = v; }, setCameraY(v) { assert.ok(Number.isFinite(v)); this.y = v; },
    setCameraZoom(v) { assert.ok(v > 0); this.zoom = v; }, convertCoords(x, y, c, r) { assert.ok(Array.isArray(r)); return [(x - 640) / this.zoom + this.x, (y - 360) / this.zoom + this.y]; } };
  const scene = { changes: [], objects: [], layer: mkLayer,
    createObject(n) { const d = layout.objects.find((o) => o.name === n); assert.ok(d, `objeto "${n}" no declarado en la escena ${layout.name}`); const o = mockObject(d); scene.objects.push(o); return o; },
    getLayer(n) { assert.ok(layers.includes(n), `capa inexistente "${n}"`); return mkLayer(n); },
    getElapsedTime: () => 100, requestChange(c, n) { scene.changes.push([c, n]); },
    getGame: () => ({ getInputManager: () => input, getJsonManager: () => json, getSoundManager: () => SND }) };
  return scene;
}

function makeInput() {
  const i = { x: 0, y: 0, down: false, rel: false, wheel: 0,
    getCursorX() { return i.x; }, getCursorY() { return i.y; }, isMouseButtonPressed: () => i.down, isMouseButtonReleased: () => i.rel, getMouseWheelDelta: () => i.wheel };
  return i;
}
const jsonMgr = { getLoadedJson(n) { assert.ok(resNames[n] && resNames[n].kind === 'json', 'recurso JSON no declarado: ' + n); return JSON.parse(fs.readFileSync(fileOf(n), 'utf8')); },
  isJsonLoaded: () => true, loadJson() {} };

/** Ejecuta los eventos de la escena igual que GDevelop: enlaces a eventos externos y luego el JS de la escena. */
function runner(layout) {
  const ext = {}; project.externalEvents.forEach((e) => { ext[e.name] = e.events.filter((x) => x.type.endsWith('JsCode')).map((x) => new Function('runtimeScene', 'eventsFunctionContext', x.inlineCode.join('\n'))); });
  return (scene) => layout.events.forEach((ev) => {
    if (ev.type.endsWith('Link')) { assert.ok(ext[ev.target], 'evento externo inexistente ' + ev.target); ext[ev.target].forEach((f) => f(scene, {})); }
    else if (ev.type.endsWith('JsCode')) new Function('runtimeScene', 'eventsFunctionContext', ev.inlineCode.join('\n'))(scene, {});
  });
}

function session(sceneName) {
  const layout = project.layouts.find((l) => l.name === sceneName), input = makeInput(), scene = makeScene(layout, input, jsonMgr);
  const run = runner(layout), s = { scene, input, layout,
    frame(n = 1) { for (let k = 0; k < n; k++) { run(scene); input.rel = false; input.wheel = 0; } },
    click(x, y) { input.x = x; input.y = y; input.down = true; run(scene); input.down = false; input.rel = true; run(scene); input.rel = false; run(scene); },
    get U() { return globalThis.gdjs.UrbanMex; } };
  return s;
}
globalThis.gdjs = { SceneChangeRequest: { CONTINUE: 0, PUSH_SCENE: 1, POP_SCENE: 2, REPLACE_SCENE: 3, CLEAR_SCENES: 4, STOP_GAME: 5 } };

test('el proyecto generado es coherente (recursos, objetos, capas, escena inicial)', () => {
  assert.equal(project.firstLayout, 'Menu');
  project.resources.resources.forEach((r) => assert.ok(fs.existsSync(fileOf(r.name)), 'falta ' + r.file));
  project.layouts.forEach((l) => { assert.ok(l.layers.some((x) => x.name === 'UI')); assert.ok(l.events.length > 5); });
  assert.equal(project.properties.scaleMode, 'nearest');
});

test('responsivo: resolución lógica fija 1280x720 (la ventana solo escala y centra el lienzo, sin recortar la interfaz)', () => {
  const p = project.properties;
  assert.equal(p.windowWidth, 1280); assert.equal(p.windowHeight, 720);
  assert.equal(p.adaptGameResolutionAtRuntime, false, 'si la resolución se adapta a la ventana, la UI (en coordenadas 1280x720) se recorta');
  assert.ok(!p.sizeOnStartupMode, 'sizeOnStartupMode debe estar vacío (sin adaptWidth/adaptHeight/scaleOuter)');
});

test('Menú → Tutorial → Nivel con clics', () => {
  const m = session('Menu'); m.frame(60);
  m.click(640, 376);   // JUGAR
  assert.deepEqual(m.scene.changes.pop(), [3, 'Tutorial']);
  const t = session('Tutorial'); t.frame(5);
  t.click(640, 644);   // ENTENDIDO
  assert.deepEqual(t.scene.changes.pop(), [3, 'Nivel']);
});

const lastModalButtons = (s) => s.scene._um.modal && s.scene._um.modal.buttons;
function playLevel(levelIndex, seed) {
  const g = globalThis.gdjs; delete g.UrbanMex;       // módulos y sesión limpios
  const s = session('Nivel'); s.frame(2);
  const U = s.U; U.session.levelIndex = levelIndex; U.Rules; // sesión creada tras cargar módulos
  return s;
}
test('un bot juega los 5 días completos con clics reales (mapa, panel, tienda, modales, noticias)', () => {
  // Los asaltos y noticias usan Math.random: la partida del bot es repetible con una semilla fija (por defecto 1). UM_SEED=n prueba otra; UM_SEED=azar, al azar.
  // (Con la semilla 2 el bot se atasca: elige la combi Coyoacán-Pantitlán, que cuesta 40 y 55 de stamina, sin poder pagarla. Es una limitación del bot, no del juego.)
  const seedEnv = process.env.UM_SEED === 'azar' ? '' : process.env.UM_SEED || '1', realRandom = Math.random;
  if (seedEnv) { let t = (+seedEnv) >>> 0; Math.random = () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  try {
  let day = 0, outcomes = [];
  const g = globalThis.gdjs; delete g.UrbanMex;
  let s = session('Nivel'); s.frame(2); const U = s.U; U.session.levelIndex = 0;
  for (; day < 5; day++) {
    delete s.scene._um; U.session.levelIndex = day;           // reinicia la escena como lo haría el motor
    s = session('Nivel'); s.frame(2);
    const um = () => s.scene._um; let guard = 1500;
    while (guard-- > 0 && !s.scene.changes.length) {
      const u = um(), run = u.run;
      if (u.modal) { const b = u.modal.buttons, n = b.length, bw = 170, x0 = 320 + (640 - (n * bw + (n - 1) * 20)) / 2;
        const buy = b.findIndex((x) => x.label === 'COMPRAR'), no = b.findIndex((x) => x.label === 'NO'), need = (cheapestStaminaPath(U, run) || { need: 0 }).need, pick = buy < 0 ? 0 : run.stamina < need && run.money > 60 ? buy : no;   // solo compra Monster si le falta para lo que resta
        s.click(x0 + pick * (bw + 20) + 85, 210 + 300 - 62 + 20); s.frame(2); continue; }
      if (u.pending || u.map.moving() || run.over) { s.frame(1); continue; }
      const bp = cheapestStaminaPath(U, run), path = bp && bp.path;
      if (!path) { s.frame(1); continue; }
      const sh = run.data.stations[run.current].shop; if (sh && run.stamina < bp.need && run.money > 60) { s.click(166, 666 + 18); s.frame(2); }
      const w = u.map.stationPos(path[1]), cam = u.map.cam;
      const sx = (w.x - cam.x) * cam.zoom + 640, sy = (w.y - cam.y) * cam.zoom + 360;
      if (sx < 80 || sx > 900 || sy < 70 || sy > 700) { u.map.fit(); s.frame(10); continue; }  // la persona pulsaría TODO para ver toda la red
      s.click(sx, sy); s.frame(1);
      if (um().selected) { s.click(132, 592 + 90 + 16); s.frame(1); }
      s.frame(8);
    }
    if (guard <= 0) { const u = um(), r = u.run; console.log('ATASCO', JSON.stringify({ cur: r.current, goal: r.level.goal, st: r.stamina, mo: r.money, min: r.minute, over: r.over, sel: u.selected, modal: u.modal && u.modal.title, pending: !!u.pending, moving: u.map.moving(), cam: u.map.cam, next: U.Graph.shortestPath(r.graph, r.current, r.level.goal, r.blocked), blocked: Object.keys(r.blocked) })); }
    assert.ok(guard > 0, `día ${day + 1}: el juego se atascó`);
    const [ch, name] = s.scene.changes[0]; assert.equal([ch, name].join(), '3,Resultado');
    outcomes.push(U.session.lastResult.won ? 'GANÓ' : 'perdió:' + U.session.lastResult.reason);
  }
  console.log('   resultados del bot (clics reales):', outcomes.join(' | '));
  assert.ok(outcomes.filter((o) => o === 'GANÓ').length >= 3);
  } finally { Math.random = realRandom; }
});

test('Resultado: botones según ganar/perder', () => {
  const s = session('Resultado'); s.frame(1); const U = s.U;
  U.session.lastResult = { won: true, levelIndex: 0, day: 'LUNES', arrival: '9:00 AM', travelTime: '1h 30m', steps: 17, money: 60, robbed: 0, stolen: 0, newsRead: 3, reason: '' };
  s.frame(2); s.click(550, 586);
  assert.deepEqual(s.scene.changes.pop(), [3, 'Nivel']); assert.equal(U.session.levelIndex, 1);
  U.session.lastResult.won = false; U.session.lastResult.reason = 'Te quedaste sin stamina.'; s.frame(2); s.click(550, 586);
  assert.deepEqual(s.scene.changes.pop(), [3, 'Nivel']); assert.equal(U.session.levelIndex, 0);
});

test('mapa isométrico: toda la red cabe en pantalla, sin zoom ni arrastre y sin quedar tapada por la interfaz', () => {
  const g = globalThis.gdjs; delete g.UrbanMex;
  const s = session('Nivel'); s.frame(2); const um = s.scene._um, cam = um.map.cam, data = um.data;
  assert.ok(cam.zoom >= 0.75 && !cam.follow, 'la cámara debe abrir encuadrando todo (zoom ' + cam.zoom + ')');
  // rectángulos de interfaz que existen sin abrir nada (el panel de estación solo cubre el borde inferior izquierdo)
  const ui = [[0, 0, 1280, 56], [16, 62, 322, 44], [920, 64, 340, 560], [920, 636, 340, 76], [16, 592, 540, 124]];
  const inRect = (x, y, r) => x > r[0] - 14 && x < r[0] + r[2] + 14 && y > r[1] - 14 && y < r[1] + r[3] + 14;
  data.stationList.forEach((st) => {
    const w = um.map.stationPos(st.id), sx = (w.x - cam.x) * cam.zoom + 640, sy = (w.y - cam.y) * cam.zoom + 360;
    assert.ok(sx > 20 && sx < 905 && sy > 60 && sy < 600, `${st.id} fuera del área libre: ${sx.toFixed(0)},${sy.toFixed(0)}`);
    ui.forEach((r) => assert.ok(!inRect(sx, sy, r), `${st.id} queda bajo la interfaz (${sx.toFixed(0)},${sy.toFixed(0)})`));
    assert.equal(um.map.pick(sx, sy), st.id, 'clic en ' + st.id + ' no selecciona esa estación');
  });
});

test('mapa menos saturado: estaciones separadas, plazas despejadas y rutas secundarias por las calles (sin diagonales ni encimarse con el Metro)', () => {
  const g = globalThis.gdjs; delete g.UrbanMex;
  const s = session('Nivel'); s.frame(2); const um = s.scene._um, d = um.data, L = g.UrbanMex.Layout;
  assert.ok(L.K >= 1.25, 'las estaciones deben separarse (K ' + L.K + ')');
  // 1) las estaciones nunca quedan a menos de ~1.3 casillas entre sí (antes las líneas 2 y 3 estaban a 1)
  let minD = 1e9;
  d.stationList.forEach((a, i) => d.stationList.forEach((b, j) => { if (j > i) minD = Math.min(minD, Math.hypot(L.pos(a).gx - L.pos(b).gx, L.pos(a).gy - L.pos(b).gy)); }));
  assert.ok(minD >= 1.25, 'estaciones demasiado juntas: ' + minD.toFixed(2));
  // 2) cada combi / transbordo: tramos solo en los ejes de la cuadrícula, y empieza y termina justo en sus estaciones
  const sec = L.secondary(d); assert.equal(sec.length, d.connections.filter((c) => c.combi || c.transfer).length);
  sec.forEach((r) => {
    const a = L.pos(d.stations[r.conn.a]), b = L.pos(d.stations[r.conn.b]), pts = r.pts;
    assert.ok(Math.hypot(pts[0].gx - a.gx, pts[0].gy - a.gy) < 1e-9 && Math.hypot(pts[pts.length - 1].gx - b.gx, pts[pts.length - 1].gy - b.gy) < 1e-9, 'no une ' + r.conn.a + ' con ' + r.conn.b);
    L.segs(pts).forEach((sg) => assert.ok(Math.abs(sg[0].gx - sg[1].gx) < 1e-9 || Math.abs(sg[0].gy - sg[1].gy) < 1e-9, 'tramo en diagonal en ' + r.conn.a + ' > ' + r.conn.b));
    assert.ok(pts.length <= 4, 'demasiados codos en ' + r.conn.a + ' > ' + r.conn.b);
  });
  // 3) ninguna ruta secundaria corre encimada con una vía del Metro más que un tramo corto (cruzarla sí es normal)
  sec.forEach((r) => assert.ok(L.stats(d, r.pts, r.conn).overlap <= 3, r.conn.a + ' > ' + r.conn.b + ' va encimada con el Metro: ' + L.stats(d, r.pts, r.conn).overlap.toFixed(1)));
  // 4) es determinista (mismo trazado siempre)
  assert.equal(JSON.stringify(L.secondary(d).map((r) => r.pts)), JSON.stringify(sec.map((r) => r.pts)));
  // 5) plaza despejada: ningún edificio ni parque a menos de 1.9 casillas de una estación
  const K = L.K, near = um.map.lots.filter((l) => l.kind && l.plaza);
  assert.equal(near.length, 0, 'hay edificios dentro de la plaza de una estación');
  assert.ok(um.map.lots.some((l) => l.plaza), 'debe haber plazas marcadas');
});

test('el jugador sigue la ruta con codos de las combis y termina exactamente en la estación destino', () => {
  const g = globalThis.gdjs; delete g.UrbanMex;
  const s = session('Nivel'); s.frame(2); const um = s.scene._um, d = um.data, map = um.map;
  const c = d.connections.find((x) => x.combi), from = c.a, to = c.b;
  const route = map.route(from, to), back = map.route(to, from);
  assert.ok(route.length >= 2 && back.length === route.length);
  assert.deepEqual(route.map((p) => [p.x, p.y]), back.slice().reverse().map((p) => [p.x, p.y]));
  map.walk(from, to, 1); for (let i = 0; i < 12; i++) map.update(0.1, um.run, um.ui, null, null);
  const end = map.stationPos(to);
  assert.ok(!map.moving() && Math.hypot(map.pp.x - end.x, map.pp.y - end.y) < 1e-6, 'el jugador no llegó a ' + to);
});

test('mapa isométrico: proyección 2:1, ciudad 2.5D y trazados de relleno', () => {
  const g = globalThis.gdjs; delete g.UrbanMex;
  const s = session('Nivel'); s.frame(2); const um = s.scene._um, a = um.data.stationList[0];
  const p0 = um.map.stationPos(a.id);
  const K = g.UrbanMex.Layout.K, b = um.data.stationList.find((x) => x.x === a.x + 2 && x.y === a.y) || null;
  assert.ok(b, 'debe haber una estación 2 casillas a la derecha de la primera');
  const p1 = um.map.stationPos(b.id); assert.ok(Math.abs(p1.x - p0.x - 48 * K) < 1e-6 && Math.abs(p1.y - p0.y - 24 * K) < 1e-6);   // +2 en x → ↘ (casilla 2:1, separada por K)
  const anims = {}; s.scene.objects.forEach((o) => { if (o.anim && /^(b\d|parque)$/.test(o.anim)) anims[o.anim] = (anims[o.anim] || 0) + 1; });
  assert.ok(Object.keys(anims).length >= 6, 'deben usarse varios tipos de edificio: ' + JSON.stringify(anims));
  assert.ok(Object.values(anims).reduce((x, y) => x + y, 0) > 100, 'la ciudad debe tener cientos de edificios');
});

test('celular: se oculta con X, reaparece con el icono de la esquina y las noticias avisan solo dentro del celular', () => {
  delete globalThis.gdjs.UrbanMex;
  const s = session('Nivel'); s.frame(2); const u = () => s.scene._um;
  u().modal = null; u().modalQueue = [];
  assert.equal(u().phone.open, true);
  // 1) celular abierto: el aviso es una notificación DENTRO del celular (ninguna ventana flotante fuera de su marco)
  const rects = [], ui = u().ui, orig = ui.rect;
  ui.rect = function (x, y, w, h, o) { rects.push({ x, y, w, h, o: o || {} }); return orig.apply(this, arguments); };
  const U = s.U, at = (id) => { const w = u().map.stationPos(id), c = u().map.cam; return [(w.x - c.x) * c.zoom + 640, (w.y - c.y) * c.zoom + 360]; };
  const settle = () => { for (let g = 300; g-- > 0 && (u().pending || u().map.moving() || u().modal);) { if (u().modal) { const b = u().modal.buttons, n = b.length, x0 = 320 + (640 - (n * 170 + (n - 1) * 20)) / 2; s.click(x0 + (n - 1) * 190 + 85, 210 + 300 - 62 + 20); } s.frame(2); } };
  const move = () => { const id = U.Graph.neighbors(u().run.graph, u().run.current).find((n) => !u().run.blocked[n] && !u().run.data.stations[n].shop); s.click(...at(id)); s.click(...at(id)); };
  // 0) sin moverse no llega ninguna noticia aunque pase el tiempo
  const n0 = u().run.newsCount; s.frame(600); assert.equal(u().run.newsCount, n0, 'las noticias solo ocurren al moverse'); assert.equal(u().push, null);
  u().run.newsMoves = 1; move(); for (let g = 120; g-- > 0 && !u().push;) s.frame(2);   // al terminar el movimiento llega la noticia
  assert.ok(u().push, 'debe aparecer la notificación'); s.frame(2);
  const ph = { x: 920, y: 64, w: 340, h: 560 }, floating = rects.filter((r) => r.o.modal);
  assert.ok(floating.length > 0, 'la notificación se dibuja');
  floating.forEach((r) => assert.ok(r.x >= ph.x && r.y >= ph.y && r.x + r.w <= ph.x + ph.w && r.y + r.h <= ph.y + ph.h, 'aviso fuera del celular: ' + JSON.stringify(r)));
  // 2) ocultar con la X del celular: el mapa aprovecha todo el ancho
  s.click(1239, 81);
  assert.equal(u().phone.open, false); assert.equal(u().push, null); assert.ok(u().map.view.x1 > 1200);
  // 3) con el celular oculto llegan noticias: no hay aviso flotante, se acumulan como "sin leer" y el icono lo señala
  settle(); const before = u().run.unread; u().run.data.config.news.chance = 1; u().run.newsMoves = 1; move(); settle(); s.frame(4);   // (chance 1: que no dependa del azar)
  assert.ok(u().run.unread > before, 'debe llegar una noticia'); assert.equal(u().push, null, 'con el celular oculto no hay aviso flotante');
  // 4) el icono de la esquina superior derecha lo vuelve a mostrar, directo a las noticias nuevas
  s.click(1248, 28);
  assert.equal(u().phone.open, true); assert.equal(u().phone.app, 'news'); s.frame(1); assert.equal(u().run.unread, 0);
  ui.rect = orig;
});

test('celular: la app LINEAS dice el color de cada línea y la resalta en el mapa; las noticias traen sus líneas', () => {
  delete globalThis.gdjs.UrbanMex;
  const s = session('Nivel'); s.frame(2); const u = () => s.scene._um; u().modal = null;
  assert.deepEqual(Object.values(u().run.data.lines).map((l) => l.colorName), ['rosa', 'azul', 'verde', 'amarilla', 'gris']);
  u().phone.app = 'lines'; s.frame(2);
  assert.equal(u().map.highlight, null);
  s.click(1000, 140 + 40 + 16);                       // fila de la Línea 2 (azul)
  assert.equal(u().map.highlight, '2');
  s.click(1000, 140 + 40 + 16); assert.equal(u().map.highlight, null);   // otro toque la quita
  u().map.highlight = '3'; u().phone.app = 'home'; s.frame(2);
  assert.equal(u().map.highlight, null, 'al salir de LINEAS el mapa vuelve a la normalidad');
  // cada noticia guarda las líneas que toca (sus colores se ven en la tarjeta)
  const run = u().run, byId = (id) => run.data.news.find((n) => n.id === id);
  u().U ? 0 : 0; s.U.News.trigger(run, byId('n12')); assert.deepEqual(run.newsLog[0].lines, ['3']);   // bloqueo en Juárez (L3)
  s.U.News.trigger(run, byId('n17')); assert.deepEqual(run.newsLog[0].lines, ['2']);                   // falla en Línea 2
});

test('doble clic: solo viaja a las estaciones VECINAS de la actual, sin confirmar, y se puede apagar en Ajustes', () => {
  delete globalThis.gdjs.UrbanMex;
  const s = session('Nivel'); s.frame(2); const u = () => s.scene._um, U = s.U; u().modal = null; u().modalQueue = [];
  U.session.dblTravel = true;
  const at = (id) => { const w = u().map.stationPos(id), c = u().map.cam; return [(w.x - c.x) * c.zoom + 640, (w.y - c.y) * c.zoom + 360]; };
  const run = u().run, start = run.current, neighbors = U.Graph.neighbors(run.graph, start).filter((n) => !run.blocked[n]);
  const far = run.data.stationList.map((x) => x.id).find((id) => id !== start && !neighbors.includes(id) && !run.blocked[id] && !run.data.stations[id].shop);
  assert.ok(neighbors.length >= 1 && far);
  // un solo clic en una vecina: solo abre el panel de viaje
  s.click(...at(neighbors[0])); assert.equal(u().selected, neighbors[0]); assert.equal(u().run.current, start); s.frame(40);
  // doble clic en una estación LEJANA (no vecina): no viaja
  s.click(...at(far)); s.click(...at(far)); s.frame(2);
  assert.equal(u().run.current, start, 'una estación lejana no debe viajar con doble clic');
  s.frame(40);
  // doble clic en una vecina: viaja de inmediato, sin pasar por el panel de confirmación
  u().selected = null; s.click(...at(neighbors[0])); s.click(...at(neighbors[0]));
  assert.equal(u().run.current, neighbors[0], 'debe viajar a la estación vecina'); assert.equal(u().selected, null);
  for (let g = 200; g-- > 0 && (u().pending || u().map.moving() || u().modal);) { if (u().modal) { const b = u().modal.buttons, n = b.length, x0 = 320 + (640 - (n * 170 + (n - 1) * 20)) / 2; s.click(x0 + (n - 1) * 190 + 85, 210 + 300 - 62 + 20); } s.frame(2); }
  // apagar la opción en AJUSTES del celular: el doble clic vuelve a ser solo un clic (abre el panel)
  u().phone.app = 'config'; s.frame(2); s.click(1090, 98 + 42 + 128 + 15);
  assert.equal(U.session.dblTravel, false);
  const here = u().run.current, next = U.Graph.neighbors(u().run.graph, here).find((n) => !u().run.blocked[n]);
  s.frame(40); s.click(...at(next)); s.click(...at(next));
  assert.equal(u().run.current, here, 'con la opción apagada el doble clic no viaja'); assert.equal(u().selected, next);
  U.session.dblTravel = true;
});

test('combi: las rutas se dibujan en el mapa con su microbús y aparecen en la leyenda', () => {
  delete globalThis.gdjs.UrbanMex;
  const s = session('Nivel'); s.frame(2);
  const n = s.scene.objects.filter((o) => o.anim === 'combi').length;
  assert.equal(n, 10, 'un microbús por cada ruta de combi (9) más el de la leyenda');
});

test('menú: JUGAR dice a qué nivel entras, el selector solo deja rejugar los completados y el progreso se guarda', () => {
  const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  try {
    delete globalThis.gdjs.UrbanMex;
    // 1) ganar un nivel guarda el progreso
    let n = session('Nivel'); n.frame(2); const um = n.scene._um; um.modal = null; um.run.over = true; um.run.won = true; n.frame(2);
    assert.deepEqual(n.U.session.completed, [0]); assert.deepEqual(JSON.parse(store['UrbanMex_save_v1']).completed, [0]);
    // 2) "reiniciar el juego": el menú lee el guardado y JUGAR lleva al nivel 2
    delete globalThis.gdjs.UrbanMex;
    let m = session('Menu'); m.frame(5); const U = m.U;
    assert.deepEqual(U.session.completed, [0]); assert.equal(U.Save.nextLevel(5), 1);
    m.click(640, 400);                                                            // JUGAR
    assert.equal(U.session.levelIndex, 1); assert.deepEqual(m.scene.changes.pop(), [3, 'Tutorial']);
    U.session.seenTutorial = true;
    // 3) selector con 2 niveles completados: solo esos se pueden rejugar (botones REJUGAR)
    U.session.completed = [0, 1]; m = session('Menu'); m.frame(5);
    m.click(640, 484);                                                            // SELECCIONAR NIVEL
    assert.equal(m.scene._um.view, 'levels');
    m.click(876, 300); m.click(1112, 300); m.click(640, 400);                     // niveles 4 y 5 (bloqueados) y el 3 (siguiente): no hacen nada
    assert.equal(m.scene.changes.length, 0);
    m.click(404, 476);                                                            // REJUGAR nivel 2
    assert.deepEqual(m.scene.changes.pop(), [3, 'Nivel']); assert.equal(U.session.levelIndex, 1);
    // 4) volver y el botón JUGAR sigue yendo al nivel 3
    m.scene._um.view = 'levels'; m.frame(2); m.click(640, 598); assert.equal(m.scene._um.view, 'main');
    m.click(640, 400); assert.equal(U.session.levelIndex, 2); assert.deepEqual(m.scene.changes.pop(), [3, 'Nivel']);
    // 5) borrar progreso pide confirmar (dos toques)
    m.scene._um.view = 'levels'; m.frame(2); m.click(1105, 676); assert.deepEqual(U.session.completed, [0, 1]); m.click(1105, 676);
    assert.deepEqual(U.session.completed, []); assert.deepEqual(JSON.parse(store['UrbanMex_save_v1']).completed, []);
  } finally { delete globalThis.localStorage; }
});

// ------------------------------------------------------------------------------------------------------------------------
// Efectos visuales (src/fx.js): iluminación dinámica, sombras suaves, partículas, bruma/bokeh y viñeta
// ------------------------------------------------------------------------------------------------------------------------
const fxObjs = (s, layer) => s.scene.objects.filter((o) => o.name === 'Fx' && !o.hidden && (layer === undefined || o.layer === layer));
const freshU = () => { delete globalThis.gdjs.UrbanMex; const m = session('Menu'); m.frame(1); return m.U; };   // carga los módulos (la calidad se fija después)

test('efectos: todas las escenas tienen la capa FX entre el mapa y la interfaz, el objeto Fx y recursos suavizados solo para los fx_*', () => {
  project.layouts.forEach((l) => {
    assert.deepEqual(l.layers.map((x) => x.name), ['', 'FX', 'UI'], 'orden de capas en ' + l.name);
    const fx = l.objects.find((o) => o.name === 'Fx'); assert.ok(fx, 'falta el objeto Fx en ' + l.name);
    assert.deepEqual(fx.animations.map((a) => a.name).sort(), ['beam', 'fog', 'glow', 'haze_b', 'haze_t', 'shadow', 'soft', 'solid', 'spark', 'vignette']);
  });
  project.resources.resources.filter((r) => r.kind === 'image').forEach((r) =>
    assert.equal(r.smoothed, r.name.startsWith('fx_'), `${r.name}: el pixel art debe quedar nítido (nearest) y los efectos suaves`));
});

test('efectos del nivel: sprites válidos, dentro de pantalla, cantidad acotada y sin tocar la composición original', () => {
  const U = freshU(); U.session.fxQuality = 'high';
  const s = session('Nivel'); s.frame(60); const um = s.scene._um;
  assert.equal(um.map.softShadow, true);
  const all = fxObjs(s), screen = fxObjs(s, 'FX'), world = fxObjs(s, '');
  assert.ok(all.length >= 60 && all.length <= 260, 'cantidad de sprites de efectos: ' + all.length);
  assert.ok(screen.length >= 30 && world.length >= 20, `pantalla ${screen.length} / mapa ${world.length}`);
  screen.forEach((o) => assert.ok(o.x > -900 && o.x < 1700 && o.y > -500 && o.y < 1100, `sprite FX fuera del área razonable: ${o.x},${o.y}`));
  assert.ok(all.some((o) => o.blend === 1) && all.some((o) => o.blend === 2) && all.some((o) => !o.blend), 'se usan mezcla aditiva, multiplicar y normal');
  // los objetos originales siguen ahí con las mismas cantidades (no se agregan ni quitan personajes/objetos)
  const count = (n) => s.scene.objects.filter((o) => o.name === n).length;
  assert.equal(count('Estacion'), um.data.stationList.length); assert.equal(count('Jugador'), 1);
  assert.equal(s.scene.objects.filter((o) => o.anim === 'combi').length, 10);
});

test('efectos: la iluminación cambia con la hora del nivel (de la luz de la mañana al anochecer) y reacciona al jugador', () => {
  const U = freshU(); U.session.fxQuality = 'high';
  const morning = U.FX.lighting(0), noon = U.FX.lighting(0.4), dusk = U.FX.lighting(1);
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  assert.ok(lum(dusk.grade) < lum(morning.grade) - 20, 'al anochecer la gradación es más oscura');
  assert.ok(dusk.grade[2] > dusk.grade[0], 'y más fría (azul/violeta)'); assert.ok(morning.grade[0] >= morning.grade[2], 'la mañana es cálida');
  assert.ok(dusk.vig > noon.vig, 'la viñeta se cierra al anochecer'); assert.ok(U.FX.lighting(0.6).sun[0] >= 240, 'la luz solar sigue siendo cálida');
  const s = session('Nivel'); s.frame(5); const um = s.scene._um, cfg = um.data.config, pool = um.fx.stage.pool;
  um.modal = null; um.run.minute = cfg.dayStartMinute; s.frame(2); const c0 = pool['FX:grade']._umColor, sun0 = pool['FX:sun'].opacity;
  um.run.minute = cfg.dayEndMinute; s.frame(2); const c1 = pool['FX:grade']._umColor;
  assert.notEqual(c0, c1, 'el color de gradación debe cambiar con la hora'); assert.ok(pool['FX:grade'].blend === 2 && Number.isFinite(sun0));
  // la luz del jugador y su sombra siguen su posición; la luz de la estación actual es la naranja
  const pl = pool[':pl:light'], sh = pool[':pl:shadow'], pp = um.map.pp;
  assert.ok(Math.abs(pl.x + 75 - pp.x) < 12 && Math.abs(sh.x + 23 - pp.x) < 12, 'luz y sombra del jugador siguen al jugador');
  assert.equal(pool[':sl:' + um.run.current]._umColor, '255;150;80');
});

test('efectos: partículas con paralaje, reproducibles y la cámara desplazada las mueve', () => {
  const U = freshU(); U.session.fxQuality = 'high';
  const snap = (s) => ['dust0', 'dust5', 'bokeh2', 'fog1'].map((k) => { const o = s.scene._um.fx.stage.pool['FX:' + k]; return [o.x, o.y].map((v) => +v.toFixed(3)).join(); }).join('|');
  const a = session('Nivel'); a.frame(40); const b = session('Nivel'); b.frame(40);
  assert.equal(snap(a), snap(b), 'misma semilla → mismas partículas');
  const before = snap(a); a.scene._um.map.pan(120, 60); a.frame(1);
  assert.notEqual(snap(a), before, 'al mover la cámara las partículas se desplazan con paralaje');
  a.frame(300); assert.ok(a.scene._um.fx.stage.pool['FX:dust0'].x > -100 && a.scene._um.fx.stage.pool['FX:dust0'].x < 1400, 'el polvo envuelve la pantalla y no se escapa');
});

test('efectos: calidad baja usa menos sprites y "off" no crea ninguno (ni cambia la sombra original del jugador)', () => {
  const U = freshU(), n = {};
  ['high', 'low', 'off'].forEach((q) => { U.session.fxQuality = q; const s = session('Nivel'); s.frame(30); n[q] = s.scene.objects.filter((o) => o.name === 'Fx').length; if (q === 'off') assert.equal(s.scene._um.map.softShadow, false); });
  assert.ok(n.high > n.low && n.low > 0 && n.off === 0, JSON.stringify(n));
  U.session.fxQuality = 'off'; const m = session('Menu'); m.frame(20); assert.equal(m.scene.objects.filter((o) => o.name === 'Fx').length, 0);
  U.session.fxQuality = 'high';
});

test('efectos: menú, tutorial y resultado (luz del tren, brillos de estrellas y resplandor según el resultado)', () => {
  const U = freshU(); U.session.fxQuality = 'high';
  const m = session('Menu'); m.frame(30); const poolM = m.scene._um.fx.stage.pool, x0 = poolM['FX:th'].x;
  assert.ok(fxObjs(m).length >= 30); m.frame(10); assert.notEqual(poolM['FX:th'].x, x0, 'el faro del tren se mueve con el tren');
  assert.ok(poolM['FX:logo'] && !poolM['FX:logo'].hidden, 'aura del logo en el menú principal'); m.scene._um.view = 'levels'; m.frame(2); assert.ok(poolM['FX:logo'].hidden, 'sin logo en el selector de niveles');
  const t = session('Tutorial'); t.frame(10); assert.ok(fxObjs(t).length >= 10);
  const r = session('Resultado'); U.session.lastResult = { won: true, levelIndex: 0, day: 'LUNES', arrival: '9:00 AM', travelTime: '1h', steps: 3, money: 5, robbed: 0, stolen: 0, newsRead: 1, reason: '' };
  r.frame(3); const win = r.scene._umFx.stage.pool['FX:top']._umColor; U.session.lastResult.won = false; r.frame(3);
  assert.notEqual(win, r.scene._umFx.stage.pool['FX:top']._umColor, 'el resplandor cambia entre ganar y perder');
});

test('efectos: el coste por fotograma es acotado (llamadas al motor) y el suelo texturizado se dibuja una sola vez', () => {
  const U = freshU(); U.session.fxQuality = 'high';
  const c0 = stats.calls; const s = session('Nivel'); s.frame(2); const build = stats.calls - c0;
  assert.ok(build > 4000, 'el suelo con texturas y sombras se pinta al abrir el nivel (' + build + ' llamadas)');
  s.scene._um.modal = null; const c1 = stats.calls; s.frame(20); const perFrame = (stats.calls - c1) / 20;
  U.session.fxQuality = 'off'; const o = session('Nivel'); o.frame(2); o.scene._um.modal = null; const c2 = stats.calls; o.frame(20); const base = (stats.calls - c2) / 20;
  console.log(`   llamadas por fotograma: con efectos ${Math.round(perFrame)} / sin efectos ${Math.round(base)} (suelo: ${build} una sola vez)`);
  assert.ok(perFrame - base < 3500, 'los efectos añaden demasiadas llamadas por fotograma: ' + Math.round(perFrame - base)); U.session.fxQuality = 'high';
});

// ------------------------------------------------------------------------------------------------------------------------
// Audio (src/audio.js): música relajante, tren lejano cada 60 s y efectos suaves
// ------------------------------------------------------------------------------------------------------------------------
const audioReset = () => { delete globalThis.gdjs.UrbanMex; SND.reset(); };
const finishModals = (s) => { for (let g = 400; g-- > 0 && (s.scene._um.pending || s.scene._um.map.moving() || s.scene._um.modal);) { const u = s.scene._um; if (u.modal) { const b = u.modal.buttons, n = b.length, x0 = 320 + (640 - (n * 170 + (n - 1) * 20)) / 2; s.click(x0 + (n - 1) * 190 + 85, 210 + 300 - 62 + 20); } s.frame(2); } };

test('audio: los archivos existen, son .ogg válidos, el proyecto los declara y las escenas no cortan los sonidos al cambiar', () => {
  audioReset(); const m = session('Menu'); m.frame(2); const A = m.U.Audio;
  const names = [...Object.values(A.MUSIC).map((x) => x.file), ...A.TRAINS, A.ALERT.file, ...Object.keys(A.SFX).map((k) => `sfx_${k}.ogg`)];
  assert.equal(new Set(names).size, 2 + 2 + 1 + 12);
  names.forEach((n) => { audioCheck(n); const b = fs.readFileSync(fileOf(n)); assert.equal(b.subarray(0, 4).toString(), 'OggS', n + ' no es un Ogg'); });
  assert.ok(!resNames['sfx_robo.ogg'] && !fs.existsSync(path.join(ROOT, 'My project', 'assets', 'audio', 'sfx_robo.ogg')), 'sfx_robo.ogg ya no existe (lo reemplaza sfx_asalto.ogg)');
  const kb = (n) => fs.statSync(fileOf(n)).size / 1024;
  assert.ok(kb('musica_menu.ogg') > 150 && kb('musica_nivel.ogg') > 150, 'las músicas duran más de un minuto'); assert.ok(kb('sfx_click.ogg') < 20, 'los efectos son cortos');
  assert.ok(kb('peligro_loop.ogg') > 15 && kb('peligro_loop.ogg') < 80 && kb('sfx_alerta.ogg') < 20, 'el bucle de apuro dura unos segundos');
  // las músicas y el bucle de apuro son de música (en bucle); lo demás, sonidos cortos
  assert.ok(project.resources.resources.filter((r) => r.kind === 'audio').every((r) => r.alwaysLoaded && (/^(musica_|peligro_)/.test(r.name) ? r.preloadAsMusic && !r.preloadAsSound : r.preloadAsSound && !r.preloadAsMusic)));
  project.layouts.forEach((l) => assert.equal(l.stopSoundsOnStartup, false, 'si GDevelop corta los sonidos al cambiar de escena, la música se reinicia: ' + l.name));
  // niveles de volumen bajos a propósito: la música es de fondo y el tren apenas se nota; incluso en el nivel 10 (×1.43) nada pasa de 70
  assert.ok(Object.values(A.MUSIC).every((x) => x.vol <= 45)); assert.ok(A.state && Object.values(A.SFX).every((v) => v <= 50) && A.ALERT.vol <= 50);
  assert.ok(Object.values(A.SFX).every((v) => v * 10 / A.DEFAULT <= 70) && A.ALERT.vol * 10 / A.DEFAULT <= 70);
  assert.ok(A.SFX.asalto > Math.max(...Object.entries(A.SFX).filter(([k]) => !['asalto', 'alerta', 'ganar'].includes(k)).map(([, v]) => v)), 'el golpe de asalto es el efecto más marcado (salvo la fanfarria)');
});

test('audio: una pista por tipo de pantalla, sin reiniciarse entre Menú/Tutorial/Resultado y con fundido al pasar al Nivel', () => {
  audioReset(); const m = session('Menu'); m.frame(5);
  assert.equal(SND.count(/^musica_/), 1); assert.equal(SND.log.find((e) => e.k === 'music').n, 'musica_menu.ogg');
  const first = SND.music[Object.keys(SND.music)[0]];
  const t = session('Tutorial'); t.frame(5); const r = session('Resultado'); r.frame(5);
  assert.equal(SND.count(/^musica_/), 1, 'misma música en Menú, Tutorial y Resultado: no se reinicia');
  const n = session('Nivel'); n.frame(3);
  assert.equal(SND.count(/^musica_/), 2); assert.equal(SND.log.filter((e) => e.k === 'music')[1].n, 'musica_nivel.ogg');
  assert.equal(first.fades.length, 1, 'la pista anterior baja con fundido'); assert.deepEqual(first.fades[0].slice(1), [0, 1800]);
  assert.equal(first.stopped, false); n.frame(25); assert.equal(first.stopped, true, 'y se detiene cuando acaba el fundido');
  const playing = Object.values(SND.music).filter((x) => !x.stopped); assert.equal(playing.length, 1); assert.equal(playing[0].n, 'musica_nivel.ogg');
  n.frame(100); assert.equal(SND.count(/^musica_/), 2, 'en el Nivel no vuelve a empezar');
});

test('audio: el tren pasa cada 60 s (primero a los 20 s), alternando lado, a volumen bajo y más suave que la música', () => {
  audioReset(); const t = session('Tutorial'); t.frame(2); const A = t.U.Audio, trains = () => SND.log.filter((e) => /^tren_/.test(e.n));
  assert.equal(A.TRAIN_EVERY, 60);
  t.frame(185); assert.equal(trains().length, 0, 'a los 18.7 s todavía no');                 // el mock avanza 0.1 s por fotograma
  t.frame(20); assert.equal(trains().length, 1, 'a los 20 s pasa el primero');
  t.frame(590); assert.equal(trains().length, 1, 'a los 79 s todavía no pasa el segundo');
  t.frame(20); assert.equal(trains().length, 2, 'a los 80 s, el segundo (60 s después)');
  t.frame(1200); assert.equal(trains().length, 4, 'y así cada minuto: 20, 80, 140 y 200 s');
  const l = trains(); assert.notEqual(l[0].n, l[1].n, 'alterna izquierda→derecha y derecha→izquierda'); assert.equal(l[0].n, l[2].n);
  assert.ok(l.every((e) => e.v <= 30), 'volumen bajo'); assert.ok(l[0].v < SND.log.find((e) => e.k === 'music').v, 'más bajo que la música');
});

test('audio: efectos suaves en clics, selección, viaje, noticias y resultado (una sola vez)', () => {
  audioReset(); const m = session('Menu'); m.frame(5); SND.log.length = 0;
  m.click(640, 484); assert.equal(SND.count(/^sfx_click/), 1, 'clic de botón en el menú');
  audioReset(); const s = session('Nivel'); s.frame(3); const u = () => s.scene._um, U = s.U; u().modal = null; u().modalQueue = [];
  const at = (id) => { const w = u().map.stationPos(id), c = u().map.cam; return [(w.x - c.x) * c.zoom + 640, (w.y - c.y) * c.zoom + 360]; };
  const run = u().run, nb = U.Graph.neighbors(run.graph, run.current).find((x) => !run.blocked[x] && !run.data.stations[x].shop);
  SND.log.length = 0; s.click(...at(nb)); assert.equal(SND.count(/^sfx_select/), 1, 'al elegir una estación');
  s.click(132, 592 + 90 + 16); assert.equal(SND.count(/^sfx_viaje/), 1, 'al viajar'); finishModals(s);
  SND.log.length = 0; const nb2 = U.Graph.neighbors(u().run.graph, u().run.current).find((x) => !u().run.blocked[x]); u().run.blocked[nb2] = true;   // fuerza el caso: estación bloqueada
  s.click(...at(nb2)); assert.equal(SND.count(/^sfx_error/), 1, 'estación bloqueada → error suave'); delete u().run.blocked[nb2];
  u().run.newsMoves = 1; u().run.data.config.news.chance = 1; const before = SND.count(/^sfx_noticia/);
  for (let i = 0; i < 6 && SND.count(/^sfx_noticia/) === before; i++) { const n2 = U.Graph.neighbors(u().run.graph, u().run.current).find((x) => !u().run.blocked[x] && !u().run.data.stations[x].shop); if (!n2) break; u().run.newsMoves = 1; s.click(...at(n2)); s.click(...at(n2)); finishModals(s); }
  assert.ok(SND.count(/^sfx_noticia/) > before, 'al llegar una noticia');
  // Resultado: fanfarria una sola vez (ganar / perder)
  audioReset(); const r = session('Resultado'); r.frame(1);
  r.U.session.lastResult = { won: true, levelIndex: 0, day: 'LUNES', arrival: '9:00 AM', travelTime: '1h', steps: 3, money: 5, robbed: 0, stolen: 0, newsRead: 1, reason: '' };
  r.frame(30); assert.equal(SND.count(/^sfx_ganar/), 1); assert.equal(SND.count(/^sfx_perder/), 0);
  audioReset(); const r2 = session('Resultado'); r2.frame(1); r2.U.session.lastResult = { won: false, levelIndex: 0, day: 'LUNES', arrival: '', travelTime: '', steps: 1, money: 0, robbed: 0, stolen: 0, newsRead: 0, reason: 'Sin stamina' };
  r2.frame(30); assert.equal(SND.count(/^sfx_perder/), 1);
});


// -------- Tres módulos de volumen: MÚSICA GENERAL, SONIDOS GENERALES y PELIGRO Y APURO
const store0 = () => { const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }; return store; };
const musicSnd = () => Object.values(SND.music).find((x) => !x.stopped && /^musica_/.test(x.n));
const alertSnd = () => Object.values(SND.music).find((x) => !x.stopped && /^peligro_/.test(x.n));
// filas del panel (menú): cada módulo ocupa 80 px desde y = 172; los botones − / barra / + / MUDO están en y + 32 (+15 de alto medio)
const MN = { x: 330, w: 620, y: (i) => 172 + i * 80 + 32 + 15, minus: 330 + 15, plus: (seg) => 330 + 34 + seg * 10 + 4 + 2 + 15, mute: 330 + 620 - 38, seg: (j, seg) => 330 + 34 + j * seg + seg / 2 };

test('volumen: el menú tiene tres módulos (música general, sonidos generales, peligro y apuro) con − / + y MUDO, y se guardan', () => {
  const store = store0();
  try {
    audioReset(); const m = session('Menu'); m.frame(5); const U = m.U, A = U.Audio, vol = () => JSON.parse(store['UrbanMex_save_v1']).vol;
    assert.deepEqual(A.GROUPS.map((g) => g.id), ['music', 'sfx', 'alert']);
    assert.deepEqual(['music', 'sfx', 'alert'].map((g) => A.level(g)), [7, 7, 7], 'de fábrica: nivel 7 (= los volúmenes base)');
    m.click(100, 29); m.frame(3);                                                    // SONIDO → panel de los tres módulos
    assert.equal(m.scene._um.view, 'sound');
    const seg = Math.floor((620 - 60 - 76 - 12 - 4) / 10);
    m.click(MN.minus, MN.y(0)); assert.equal(A.level('music'), 6); assert.equal(A.level('sfx'), 7); assert.equal(A.level('alert'), 7, 'cada módulo es independiente');
    m.click(MN.plus(seg), MN.y(1)); assert.equal(A.level('sfx'), 8);
    m.click(MN.seg(1, seg), MN.y(2)); assert.equal(A.level('alert'), 2, 'tocar un paso de la barra fija ese volumen');
    assert.deepEqual(vol(), { music: { level: 6, mute: false }, sfx: { level: 8, mute: false }, alert: { level: 2, mute: false } }, 'se guarda al cambiar');
    for (let i = 0; i < 20; i++) m.click(MN.plus(seg), MN.y(0)); assert.equal(A.level('music'), 10, 'tope en 10');
    for (let i = 0; i < 20; i++) m.click(MN.minus, MN.y(0)); assert.equal(A.level('music'), 0, 'piso en 0');
    m.click(MN.plus(seg), MN.y(0)); assert.equal(A.level('music'), 1);
    // MUDO / ACTIVAR por módulo
    m.click(MN.mute, MN.y(1)); assert.equal(A.muted('sfx'), true); assert.equal(A.gain('sfx'), 0); assert.equal(A.muted('music'), false);
    assert.equal(vol().sfx.mute, true); assert.equal(vol().sfx.level, 8, 'silenciar no pierde el nivel');
    m.click(MN.mute, MN.y(1)); assert.equal(A.muted('sfx'), false); assert.ok(Math.abs(A.gain('sfx') - 8 / 7) < 1e-9);
    // "reiniciar el juego": todo vuelve como se dejó
    m.click(MN.mute, MN.y(2)); audioReset(); const m2 = session('Menu'); m2.frame(5);
    assert.deepEqual(['music', 'sfx', 'alert'].map((g) => m2.U.Audio.level(g)), [1, 8, 2]); assert.deepEqual(['music', 'sfx', 'alert'].map((g) => m2.U.Audio.muted(g)), [false, false, true]);
    m2.click(100, 29); m2.frame(3); m2.click(640, 544); m2.frame(2); assert.equal(m2.scene._um.view, 'main', 'VOLVER regresa al menú');
  } finally { delete globalThis.localStorage; delete globalThis.gdjs.UrbanMex; SND.reset(); }
});

test('menú: botón SALIR abajo del todo; pide confirmación y, si se acepta, cierra el juego (STOP_GAME) y guarda', () => {
  const store = store0();
  try {
    audioReset(); const m = session('Menu'); m.frame(5); const um = m.scene._um;
    const quit = [490 + 150, 574 + 20], si = [360 + 560 - 260 + 110, 200 + 250 - 70 + 22], no = [360 + 40 + 110, 200 + 250 - 70 + 22];
    // el botón está debajo de todos los demás botones del menú principal
    assert.ok(574 > 516 + 40, 'SALIR queda debajo de COMO JUGAR');
    m.click(...quit); m.frame(2); assert.equal(um.confirmExit, true, 'abre la ventana de confirmación'); assert.equal(m.scene.changes.length, 0, 'todavía no cierra');
    // con la ventana abierta nada de abajo responde: un clic sobre JUGAR no hace nada
    m.click(640, 400); m.frame(2); assert.equal(m.scene.changes.length, 0); assert.equal(um.confirmExit, true);
    // CANCELAR: se cierra la ventana, el juego sigue
    m.click(...no); m.frame(2); assert.equal(um.confirmExit, false); assert.equal(m.scene.changes.length, 0);
    // SALIR otra vez → SI, SALIR: pide cerrar el juego
    m.click(...quit); m.frame(2); assert.equal(um.confirmExit, true); m.click(...si); m.frame(2);
    assert.deepEqual(m.scene.changes.map((c) => c[0]), [globalThis.gdjs.SceneChangeRequest.STOP_GAME], 'pide cerrar el juego una sola vez');
    assert.equal(um.confirmExit, false); assert.equal(um.view, 'bye', 'despedida por si el entorno no puede cerrar la ventana');
    assert.ok(store['UrbanMex_save_v1'], 'se guarda al salir');
    m.click(640, 424); m.frame(2); assert.equal(um.view, 'main', 'VOLVER AL MENU funciona si no se pudo cerrar');
  } finally { delete globalThis.localStorage; delete globalThis.gdjs.UrbanMex; SND.reset(); }
});

test('volumen: guardados viejos o dañados no rompen nada (interruptor único antiguo → todo en silencio; niveles inválidos → de fábrica)', () => {
  const store = store0();
  try {
    store['UrbanMex_save_v1'] = JSON.stringify({ v: 1, completed: [0], audio: false });
    audioReset(); const a = session('Menu'); a.frame(3);
    assert.deepEqual(['music', 'sfx', 'alert'].map((g) => a.U.Audio.muted(g)), [true, true, true]); assert.deepEqual(a.U.session.completed, [0]);
    store['UrbanMex_save_v1'] = JSON.stringify({ v: 1, completed: [], vol: { music: { level: 99, mute: 'sí' }, sfx: { level: 3.5 }, alert: null } });
    audioReset(); const b = session('Menu'); b.frame(3);
    assert.deepEqual(['music', 'sfx', 'alert'].map((g) => b.U.Audio.level(g)), [7, 7, 7]); assert.deepEqual(['music', 'sfx', 'alert'].map((g) => b.U.Audio.muted(g)), [false, false, false]);
    store['UrbanMex_save_v1'] = '{ no es json'; audioReset(); const c = session('Menu'); c.frame(3); assert.equal(c.U.Audio.level('music'), 7);
  } finally { delete globalThis.localStorage; delete globalThis.gdjs.UrbanMex; SND.reset(); }
});

test('volumen: la música sigue el nivel y el silencio en vivo (sin saltos), y los sonidos y el tren salen con el volumen de su módulo', () => {
  audioReset(); const m = session('Menu'); m.frame(5); const A = m.U.Audio, base = A.MUSIC.menu.vol / 100;
  assert.ok(Math.abs(musicSnd().vol - base) < 1e-9, 'nivel 7 = volumen base');
  A.setLevel(m.scene, 'music', 10); m.frame(60); assert.ok(Math.abs(musicSnd().vol - base * 10 / 7) < 0.005, 'nivel 10 = ×1.43');
  A.setLevel(m.scene, 'music', 3); m.frame(60); assert.ok(Math.abs(musicSnd().vol - base * 3 / 7) < 0.005);
  const v1 = musicSnd().vol; A.toggleMute(m.scene, 'music'); m.frame(1); assert.ok(musicSnd().vol < v1 && musicSnd().vol > 0, 'el silencio entra con un fundido corto, no de golpe');
  m.frame(60); assert.equal(musicSnd().vol, 0, 'en silencio: volumen 0'); assert.equal(SND.gv, 100, 'no se toca el volumen global');
  A.toggleMute(m.scene, 'music'); m.frame(60); assert.ok(Math.abs(musicSnd().vol - base * 3 / 7) < 0.005, 'al reactivar vuelve al mismo nivel');
  // arrancar con el módulo en silencio no deja oír ni un instante de música
  const store = store0();
  try { A.setLevel(m.scene, 'music', 7); A.toggleMute(m.scene, 'music'); audioReset(); const m2 = session('Menu'); m2.frame(1); assert.equal(musicSnd().vol, 0, 'ya empieza en 0, sin un instante de música'); }
  finally { delete globalThis.localStorage; }
  // efectos y tren con el volumen del módulo "sonidos generales"
  audioReset(); const s = session('Menu'); s.frame(2); const B = s.U.Audio; SND.log.length = 0;
  B.setLevel(s.scene, 'sfx', 3); SND.log.length = 0; B.play(s.scene, 'noticia'); assert.ok(Math.abs(SND.log[0].v - B.SFX.noticia * 3 / 7) < 1e-9, 'efecto con el volumen del módulo');
  s.frame(20 * 61); const t = SND.log.filter((e) => /^tren_/.test(e.n)); assert.ok(t.length >= 1); assert.ok(Math.abs(t[0].v - 28 * 3 / 7) < 1e-9, 'el tren sale con el volumen del módulo de sonidos');
  B.toggleMute(s.scene, 'sfx'); SND.log.length = 0; B.play(s.scene, 'noticia'); s.frame(900); assert.equal(SND.log.filter((e) => e.k === 'sound').length, 0, 'sonidos en MUDO: ni efectos ni tren');
  // el módulo de música no afecta a los sonidos y al revés
  audioReset(); const u = session('Menu'); u.frame(2); u.U.Audio.toggleMute(u.scene, 'music'); SND.log.length = 0; u.U.Audio.play(u.scene, 'moneda'); assert.equal(SND.count(/^sfx_moneda/), 1);
});

test('apuro: con menos del 15 % del tiempo o del dinero suena el latido (con fundido), la música baja, y se apaga al terminar o al silenciar su módulo', () => {
  audioReset(); const s = session('Nivel'); s.frame(3); const u = () => s.scene._um, A = s.U.Audio, run = u().run, cfg = run.data.config; u().modal = null; u().modalQueue = [];
  assert.equal(A.danger(run), false); s.frame(60); assert.equal(alertSnd(), undefined, 'al empezar no hay apuro');
  const span = cfg.dayEndMinute - cfg.dayStartMinute, edge = cfg.dayEndMinute - 0.15 * span;     // minuto en que queda justo el 15 % del tiempo
  run.minute = edge - 1; assert.equal(A.danger(run), false, '15.1 % del tiempo: aún no'); run.minute = edge + 1; assert.equal(A.danger(run), true, 'menos del 15 % del tiempo');
  const base = A.MUSIC.nivel.vol / 100; s.frame(2); const al = alertSnd();
  assert.ok(al, 'empieza el bucle de apuro'); assert.equal(al.n, 'peligro_loop.ogg'); assert.equal(al.ch, 2, 'en su propio canal');
  assert.ok(al.vol > 0 && al.vol < A.ALERT.vol / 100 * 0.5, 'entra con fundido (no de golpe): ' + al.vol); s.frame(120); assert.ok(Math.abs(alertSnd().vol - A.ALERT.vol / 100) < 0.01, 'llega a su volumen');
  assert.ok(musicSnd().vol < base * 0.8, 'la música tiene que bajar de verdad (menos del 80 %)'); assert.ok(Math.abs(musicSnd().vol - base * A.ALERT.duck) < 0.01, 'la música baja a ' + A.ALERT.duck * 100 + ' % mientras dura el apuro'); assert.equal(SND.count(/^peligro_/), 1, 'una sola vez, no se reinicia');
  s.frame(600); assert.equal(SND.count(/^peligro_/), 1);
  // módulo en MUDO: se apaga (con fundido), la música vuelve y no ducking
  A.toggleMute(s.scene, 'alert'); s.frame(120); assert.equal(alertSnd(), undefined, 'silenciado: se detiene'); assert.ok(Math.abs(musicSnd().vol - base) < 0.01, 'sin apuro sonoro, la música no baja');
  A.toggleMute(s.scene, 'alert'); s.frame(5); assert.ok(alertSnd(), 'al reactivar, vuelve mientras haya apuro');
  // el apuro termina: sale con fundido y se detiene; dinero: 15 %
  run.minute = cfg.dayStartMinute; assert.equal(A.danger(run), false); s.frame(150); assert.equal(alertSnd(), undefined, 'ya no hay apuro: se apaga'); assert.ok(Math.abs(musicSnd().vol - base) < 0.01);
  // energía (stamina): también cuenta, y es lo que se agota primero al viajar sin comprar Monster
  run.minute = cfg.dayStartMinute; run.money = run.level.moneyStart; run.stamina = run.staminaMax; assert.equal(A.danger(run), false);
  run.stamina = Math.floor(0.15 * run.staminaMax) + 1; assert.equal(A.danger(run), false, 'poco más del 15 % de la energía'); run.stamina = Math.ceil(0.15 * run.staminaMax) - 1; assert.equal(A.danger(run), true, 'menos del 15 % de la energía');
  run.stamina = 5; assert.equal(A.danger(run), true, 'con 5 de energía hay apuro'); s.frame(5); assert.ok(alertSnd(), 'suena el latido con 5 de energía'); run.stamina = run.staminaMax;
  const ms = run.level.moneyStart; run.money = Math.floor(0.15 * ms) + 1; assert.equal(A.danger(run), false, 'poco más del 15 % del dinero'); run.money = Math.ceil(0.15 * ms) - 1; assert.equal(A.danger(run), true, 'menos del 15 % del dinero');
  s.frame(5); assert.ok(alertSnd()); run.money = 10; assert.equal(A.danger(run), true, 'con 10 monedas hay apuro'); run.money = ms; run.minute = edge + 5; assert.equal(A.danger(run), true, 'tiempo, dinero o energía: cualquiera de los tres');
  run.over = true; assert.equal(A.danger(run), false, 'con la partida terminada ya no hay apuro'); s.frame(150); assert.equal(alertSnd(), undefined);
});

test('apuro: un aviso de dos pitidos suena UNA vez al entrar en apuro (no se repite mientras dura, y vuelve a sonar en el siguiente apuro)', () => {
  audioReset(); const s = session('Nivel'); s.frame(3); const u = s.scene._um, A = s.U.Audio, run = u.run; u.modal = null; u.modalQueue = [];
  s.frame(40); assert.equal(SND.count(/^sfx_alerta/), 0, 'sin apuro, sin aviso');
  run.stamina = 5; s.frame(3); assert.equal(SND.count(/^sfx_alerta/), 1, 'aviso al entrar'); assert.equal(SND.log.find((e) => /alerta/.test(e.n)).v, A.SFX.alerta);
  s.frame(200); assert.equal(SND.count(/^sfx_alerta/), 1, 'no se repite mientras dura el apuro');
  run.stamina = run.staminaMax; s.frame(150); run.money = 10; s.frame(3); assert.equal(SND.count(/^sfx_alerta/), 2, 'otro apuro, otro aviso');
  A.toggleMute(s.scene, 'alert'); run.money = run.level.moneyStart; s.frame(5); run.money = 10; s.frame(5); assert.equal(SND.count(/^sfx_alerta/), 2, 'PELIGRO Y APURO en MUDO: sin aviso');
});

test('apuro: al salir del Nivel el latido se apaga solo, y su volumen es el del módulo PELIGRO Y APURO', () => {
  audioReset(); const s = session('Nivel'); s.frame(3); const u = s.scene._um, A = s.U.Audio; u.modal = null; A.setLevel(s.scene, 'alert', 10);
  u.run.minute = u.run.data.config.dayEndMinute - 30; s.frame(200); assert.ok(Math.abs(alertSnd().vol - A.ALERT.vol * 10 / 7 / 100) < 0.01, 'nivel 10 del módulo = ×1.43');
  A.setLevel(s.scene, 'alert', 2); s.frame(200); assert.ok(Math.abs(alertSnd().vol - A.ALERT.vol * 2 / 7 / 100) < 0.01, 'el cambio de nivel se oye en vivo');
  audioReset();
  // en otra pantalla (Resultado) ya no pide apuro: se apaga
  const r = session('Resultado'); r.frame(2); assert.equal(alertSnd(), undefined);
});

test('asalto: el golpe brusco suena al ser asaltado, con el volumen de PELIGRO Y APURO (no de los sonidos generales), y en MUDO no suena', () => {
  const rob = (muteWhat) => {
    audioReset(); const s = session('Nivel'); s.frame(3); const u = s.scene._um, A = s.U.Audio, run = u.run; u.modal = null; u.modalQueue = [];
    if (muteWhat) A.toggleMute(s.scene, muteWhat);
    run.rnd = () => 0;                                                              // con 0 siempre hay asalto en una estación reportada
    const nb = s.U.Graph.neighbors(run.graph, run.current).find((x) => !run.blocked[x] && !run.data.stations[x].shop); run.danger[nb] = true;
    SND.log.length = 0; const at = (id) => { const w = u.map.stationPos(id), c = u.map.cam; return [(w.x - c.x) * c.zoom + 640, (w.y - c.y) * c.zoom + 360]; };
    s.click(...at(nb)); s.click(...at(nb)); for (let g = 0; g < 400 && !SND.count(/^sfx_asalto/) && (u.pending || u.map.moving() || g < 5); g++) s.frame(2);
    return { s, u, A, run };
  };
  const a = rob(); assert.equal(a.run.robbed, 1, 'el jugador fue asaltado'); assert.equal(SND.count(/^sfx_asalto/), 1, 'un golpe por asalto'); assert.equal(SND.count(/^sfx_robo/), 0);
  assert.ok(Math.abs(SND.log.find((e) => /asalto/.test(e.n)).v - a.A.SFX.asalto) < 1e-9, 'volumen de fábrica');
  const b = rob('sfx'); assert.equal(b.run.robbed, 1); assert.equal(SND.count(/^sfx_asalto/), 1, 'silenciar SONIDOS GENERALES no silencia el asalto (es de PELIGRO Y APURO)');
  const c = rob('alert'); assert.equal(c.run.robbed, 1); assert.equal(SND.count(/^sfx_asalto/), 0, 'PELIGRO Y APURO en MUDO: sin golpe');
  // vía directa: el efecto de asalto obedece a su módulo
  audioReset(); const d = session('Menu'); d.frame(2); d.U.Audio.setLevel(d.scene, 'alert', 3); SND.log.length = 0; d.U.Audio.play(d.scene, 'asalto');
  assert.ok(Math.abs(SND.log[0].v - d.U.Audio.SFX.asalto * 3 / 7) < 1e-9);
});

test('celular: la app SONIDO (y el acceso desde AJUSTES) muestra los tres módulos y funciona igual que en el menú', () => {
  const store = store0();
  try {
    audioReset(); const s = session('Nivel'); s.frame(3); const u = s.scene._um, A = s.U.Audio; u.modal = null; u.phone.app = 'home'; s.frame(2);
    assert.ok(project.layouts.find((l) => l.name === 'Nivel').objects.find((o) => o.name === 'Icono').animations.some((a) => a.name === 'sonido'), 'el icono "sonido" existe');
    // tile SONIDO en el inicio del celular: 5.º (columna izquierda de la 3.ª fila)
    s.click(920 + 10 + 8 + 75, 64 + 34 + 10 + 28 + 2 * 124 + 56); s.frame(2); assert.equal(u.phone.app, 'snd');
    const y0 = 64 + 34 + 42 + 4, bar = (i) => y0 + i * 80 + 32 + 15, w = 304, x0 = 920 + 10 + 8, seg = Math.floor((w - 60 - 76 - 12 - 4) / 10);
    s.click(x0 + 15, bar(0)); assert.equal(A.level('music'), 6);
    s.click(x0 + 34 + seg * 10 + 4 + 2 + 15, bar(1)); assert.equal(A.level('sfx'), 8);
    s.click(x0 + w - 38, bar(2)); assert.equal(A.muted('alert'), true); s.click(x0 + w - 38, bar(2)); assert.equal(A.muted('alert'), false);
    assert.equal(JSON.parse(store['UrbanMex_save_v1']).vol.music.level, 6);
    // desde AJUSTES: "SONIDO Y MUSICA >" lleva a la misma app y SALIR AL MENU sigue en su lugar
    u.phone.app = 'config'; s.frame(2); s.click(1000, 140 + 232 + 15); s.frame(2); assert.equal(u.phone.app, 'snd');
    u.phone.app = 'config'; s.frame(2); s.click(1000, 140 + 340 + 14); assert.equal(u.exitToMenu, true);
  } finally { delete globalThis.localStorage; delete globalThis.gdjs.UrbanMex; SND.reset(); }
});
