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
        const buy = b.findIndex((x) => x.label === 'COMPRAR'), no = b.findIndex((x) => x.label === 'NO'), pick = buy < 0 ? 0 : run.stamina < 60 && run.money > 60 ? buy : no;   // solo compra Monster si lo necesita
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

test('celular: se oculta con X, reaparece con el icono de la esquina y las noticias avisan solo dentro del celular', () => {
  delete globalThis.gdjs.UrbanMex;
  const s = session('Nivel'); s.frame(2); const u = () => s.scene._um;
  u().modal = null; u().modalQueue = [];
  assert.equal(u().phone.open, true);
  // 1) celular abierto: el aviso es una notificación DENTRO del celular (ninguna ventana flotante fuera de su marco)
  const rects = [], ui = u().ui, orig = ui.rect;
  ui.rect = function (x, y, w, h, o) { rects.push({ x, y, w, h, o: o || {} }); return orig.apply(this, arguments); };
  u().run.newsTimer = 0; s.frame(2);
  assert.ok(u().push, 'debe aparecer la notificación');
  const ph = { x: 920, y: 64, w: 340, h: 560 }, floating = rects.filter((r) => r.o.modal);
  assert.ok(floating.length > 0, 'la notificación se dibuja');
  floating.forEach((r) => assert.ok(r.x >= ph.x && r.y >= ph.y && r.x + r.w <= ph.x + ph.w && r.y + r.h <= ph.y + ph.h, 'aviso fuera del celular: ' + JSON.stringify(r)));
  // 2) ocultar con la X del celular: el mapa aprovecha todo el ancho
  s.click(1239, 81);
  assert.equal(u().phone.open, false); assert.equal(u().push, null); assert.ok(u().map.view.x1 > 1200);
  // 3) con el celular oculto llegan noticias: no hay aviso flotante, se acumulan como "sin leer" y el icono lo señala
  const before = u().run.unread; let guard = 60;
  while (guard-- > 0 && u().run.unread === before) { u().run.newsTimer = 0; s.frame(1); }
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
  assert.equal(n, 9, 'un microbús por cada ruta de combi (8) más el de la leyenda');
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
