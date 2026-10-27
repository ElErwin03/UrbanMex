// Prueba de humo: ejecuta el proyecto GENERADO ("My project/UrbanMex.json") sobre un motor simulado y estricto.
// El simulado solo permite métodos del runtime de GDevelop verificados contra su código fuente, valida nombres de
// objetos/animaciones/capas/recursos y rechaza NaN o colores mal formados. Juega una semana completa con un bot.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { ROOT, DATA } = require('./helpers');
const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'My project', 'UrbanMex.json'), 'utf8'));
const resNames = {}; project.resources.resources.forEach((r) => { resNames[r.name] = r; });
const fileOf = (n) => path.join(ROOT, 'My project', resNames[n].file);

const ALLOWED = {
  common: ['setLayer', 'setPosition', 'setX', 'setY', 'getX', 'getY', 'setZOrder', 'hide', 'setOpacity', 'getWidth', 'getHeight', 'deleteFromScene'],
  Sprite: ['setAnimationName', 'setScale', 'setColor'],
  'TextObject::Text': ['setText', 'setCharacterSize', 'setColor', 'setFontName'],
  'PrimitiveDrawing::Drawer': ['clear', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawLineV2', 'setFillColor', 'setFillOpacity',
    'setOutlineColor', 'setOutlineOpacity', 'setOutlineSize', 'setCoordinatesRelative',
    'beginFillPath', 'drawPathLineTo', 'closePath', 'endFillPath']   // trazados de relleno (isométrico): verificados en shapepainterruntimeobject.ts
};
const COLOR_FN = ['setColor', 'setFillColor', 'setOutlineColor'];
let stats = { calls: 0 };

function mockObject(def) {
  const allowed = new Set(ALLOWED.common.concat(ALLOWED[def.type] || [])), state = { x: 0, y: 0, hidden: false, anim: null };
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
      if (k === 'setPosition') { t.x = args[0]; t.y = args[1]; }
      if (k === 'setX') t.x = args[0];
      if (k === 'setY') t.y = args[0];
      if (k === 'hide') t.hidden = args[0] !== false;
      if (k === 'getX') return t.x; if (k === 'getY') return t.y;
      if (k === 'getWidth' || k === 'getHeight') return 32;
    };
  } });
}

function makeScene(layout, input, json) {
  const layers = layout.layers.map((l) => l.name), cams = {};
  const mkLayer = (n) => cams[n] = cams[n] || { x: 640, y: 360, zoom: 1, setCameraX(v) { assert.ok(Number.isFinite(v)); this.x = v; }, setCameraY(v) { assert.ok(Number.isFinite(v)); this.y = v; },
    setCameraZoom(v) { assert.ok(v > 0); this.zoom = v; }, convertCoords(x, y, c, r) { assert.ok(Array.isArray(r)); return [(x - 640) / this.zoom + this.x, (y - 360) / this.zoom + this.y]; } };
  const scene = { changes: [], objects: [], layer: mkLayer,
    createObject(n) { const d = layout.objects.find((o) => o.name === n); assert.ok(d, `objeto "${n}" no declarado en la escena ${layout.name}`); const o = mockObject(d); scene.objects.push(o); return o; },
    getLayer(n) { assert.ok(layers.includes(n), `capa inexistente "${n}"`); return mkLayer(n); },
    getElapsedTime: () => 100, requestChange(c, n) { scene.changes.push([c, n]); },
    getGame: () => ({ getInputManager: () => input, getJsonManager: () => json }) };
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
        const buy = b.findIndex((x) => x.label === 'COMPRAR'), pick = buy >= 0 && run.stamina < 60 ? buy : 0;
        s.click(x0 + pick * (bw + 20) + 85, 210 + 300 - 62 + 20); s.frame(2); continue; }
      if (u.pending || u.map.moving() || run.over) { s.frame(1); continue; }
      const path = U.Graph.shortestPath(run.graph, run.current, run.level.goal, run.blocked);
      if (!path) { s.frame(1); continue; }
      const sh = run.data.stations[run.current].shop; if (sh && run.stamina < 60 && run.money > 60) { s.click(166, 666 + 18); s.frame(2); }
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
  assert.ok(cam.zoom >= 0.9 && !cam.follow, 'la cámara debe abrir encuadrando todo (zoom ' + cam.zoom + ')');
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

test('mapa isométrico: proyección 2:1, ciudad 2.5D y trazados de relleno', () => {
  const g = globalThis.gdjs; delete g.UrbanMex;
  const s = session('Nivel'); s.frame(2); const um = s.scene._um, a = um.data.stationList[0];
  const p0 = um.map.stationPos(a.id);
  const b = um.data.stationList.find((x) => x.x === a.x + 1 && x.y === a.y) || null;
  if (b) { const p1 = um.map.stationPos(b.id); assert.equal(p1.x - p0.x, 24); assert.equal(p1.y - p0.y, 12); }   // +1 en x → ↘ (media casilla 24x12)
  const anims = {}; s.scene.objects.forEach((o) => { if (o.anim && /^(b\d|parque)$/.test(o.anim)) anims[o.anim] = (anims[o.anim] || 0) + 1; });
  assert.ok(Object.keys(anims).length >= 6, 'deben usarse varios tipos de edificio: ' + JSON.stringify(anims));
  assert.ok(Object.values(anims).reduce((x, y) => x + y, 0) > 100, 'la ciudad debe tener cientos de edificios');
});
