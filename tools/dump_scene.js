#!/usr/bin/env node
/* Vista previa sin GDevelop, paso 1/2: ejecuta una escena del proyecto GENERADO ("My project/UrbanMex.json") sobre un motor simulado
 * que REGISTRA lo que se dibuja (sprites, textos y comandos de los objetos Dibujante) y lo vuelca a un JSON.
 * El paso 2 (tools/render_preview.py) convierte ese JSON en un PNG.
 *
 *   node tools/dump_scene.js <carpeta-del-repo> <Escena> <salida.json> [--level N] [--frames N] [--minute M] [--select ESTACION] [--modal] [--result win|lose]
 *
 * Es una aproximación fiel del orden de dibujo (capas, zOrder, cámara), no el renderizador real de GDevelop:
 * no reproduce filtros/efectos de capa de GDevelop (Adjustment, etc.) ni el suavizado exacto de la GPU. Sí registra escala X/Y, ángulo
 * y modo de mezcla (0 normal, 1 aditivo, 2 multiplicar, 3 pantalla) de los sprites de efectos. */
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] === undefined || args[i + 1].startsWith('--') ? true : args[i + 1]); };
const [repo, sceneName, outFile] = args;
if (!repo || !sceneName || !outFile) { console.error('uso: node tools/dump_scene.js <repo> <Escena> <salida.json> [--level N] [--frames N] [--minute M] [--select ESTACION] [--modal]'); process.exit(1); }
const PROJ = path.join(path.resolve(repo), 'My project');
const project = JSON.parse(fs.readFileSync(path.join(PROJ, 'UrbanMex.json'), 'utf8'));
const res = {}; project.resources.resources.forEach((r) => { res[r.name] = r; });
const layout = project.layouts.find((l) => l.name === sceneName);
if (!layout) { console.error('escena inexistente: ' + sceneName); process.exit(1); }

const objs = [];
function mock(def) {
  const o = { def, x: 0, y: 0, z: 0, layer: '', opacity: 255, hidden: false, anim: null, scale: 1, sx: 1, sy: 1, blend: 0, angle: 0, color: '255;255;255', text: '', size: 8, ops: [], fill: '255;255;255', fo: 255, oc: '255;255;255', oo: 255, idx: objs.length };
  const api = {
    setLayer(n) { o.layer = n; }, setPosition(x, y) { o.x = x; o.y = y; }, setX(x) { o.x = x; }, setY(y) { o.y = y; }, getX: () => o.x, getY: () => o.y,
    setZOrder(z) { o.z = z; }, hide(h) { o.hidden = h !== false; }, setOpacity(v) { o.opacity = v; }, getWidth: () => 32, getHeight: () => 32, deleteFromScene() { o.deleted = true; },
    setAnimationName(a) { o.anim = a; }, setScale(s) { o.scale = s; o.sx = s; o.sy = s; }, setScaleX(s) { o.sx = s; }, setScaleY(s) { o.sy = s; }, setBlendMode(b) { o.blend = b; }, setAngle(a) { o.angle = a; }, setColor(c) { o.color = c; },
    setText(t) { o.text = t; }, setCharacterSize(s) { o.size = s; }, setFontName() {},
    clear() { o.ops = []; }, setFillColor(c) { o.fill = c; }, setFillOpacity(v) { o.fo = v; }, setOutlineColor(c) { o.oc = c; }, setOutlineOpacity(v) { o.oo = v; },
    setOutlineSize() {}, setCoordinatesRelative() {},
  };
  ['drawRectangle', 'drawCircle', 'drawEllipse', 'drawLineV2', 'beginFillPath', 'drawPathLineTo', 'closePath', 'endFillPath'].forEach((k) => {
    api[k] = (...a) => { a.forEach((v) => { if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(def.name + '.' + k + ': argumento no numérico ' + v); }); o.ops.push({ k, a, fill: o.fill, fo: o.fo, oc: o.oc, oo: o.oo }); };
  });
  Object.keys(api).forEach((k) => { Object.defineProperty(o, k, { value: api[k], enumerable: false }); });
  objs.push(o); return o;
}

const layers = layout.layers.map((l) => l.name), cams = {};
const mkLayer = (n) => cams[n] = cams[n] || { x: 640, y: 360, zoom: 1, setCameraX(v) { this.x = v; }, setCameraY(v) { this.y = v; }, setCameraZoom(v) { this.zoom = v; },
  convertCoords(x, y, c, r) { return [(x - 640) / this.zoom + this.x, (y - 360) / this.zoom + this.y]; } };
const input = { x: 0, y: 0, down: false, rel: false, wheel: 0, getCursorX() { return input.x; }, getCursorY() { return input.y; }, isMouseButtonPressed: () => input.down, isMouseButtonReleased: () => input.rel, getMouseWheelDelta: () => input.wheel };
const jsonMgr = { getLoadedJson(n) { return JSON.parse(fs.readFileSync(path.join(PROJ, res[n].file), 'utf8')); }, isJsonLoaded: () => true, loadJson() {} };
const scene = { changes: [], createObject(n) { const d = layout.objects.find((x) => x.name === n); if (!d) throw new Error('objeto "' + n + '" no declarado en ' + layout.name); return mock(d); },
  getLayer(n) { if (!layers.includes(n)) throw new Error('capa inexistente "' + n + '"'); return mkLayer(n); },
  getElapsedTime: () => 100, requestChange(c, n) { scene.changes.push([c, n]); }, getGame: () => ({ getInputManager: () => input, getJsonManager: () => jsonMgr }) };
globalThis.gdjs = { SceneChangeRequest: { CONTINUE: 0, PUSH_SCENE: 1, POP_SCENE: 2, REPLACE_SCENE: 3, CLEAR_SCENES: 4, STOP_GAME: 5 } };

const ext = {}; project.externalEvents.forEach((e) => { ext[e.name] = e.events.filter((x) => x.type.endsWith('JsCode')).map((x) => new Function('runtimeScene', 'eventsFunctionContext', x.inlineCode.join('\n'))); });
const frame = () => { layout.events.forEach((ev) => {
  if (ev.type.endsWith('Link')) ext[ev.target].forEach((f) => f(scene, {}));
  else if (ev.type.endsWith('JsCode')) new Function('runtimeScene', 'eventsFunctionContext', ev.inlineCode.join('\n'))(scene, {});
}); };

const frames = +flag('frames', 12), U = () => globalThis.gdjs.UrbanMex;
frame();                                                       // 1.er fotograma: crea los módulos (y la sesión)
if (flag('level')) U().session.levelIndex = +flag('level');
if (flag('result'))                                            // escena Resultado: --result win | lose (datos de ejemplo)
  U().session.lastResult = { won: flag('result') === 'win', levelIndex: 0, day: 'LUNES', arrival: '9:00 AM', travelTime: '2h 00m', steps: 14, money: 60, robbed: 1, stolen: 40, newsRead: 5, reason: 'Te quedaste sin stamina.' };
for (let i = 0; i < frames; i++) {
  frame();
  const um = scene._um;
  if (um && um.run) {
    if (!flag('modal')) um.modal = null;                       // quita la ventana de "EMPEZAR" para ver el mapa
    if (flag('minute')) um.run.minute = +flag('minute');
    if (flag('select') && um.run.data.stations[flag('select')]) um.selected = flag('select');
  }
}

const images = {};
objs.forEach((o) => { if (o.def.type === 'Sprite') o.def.animations.forEach((a) => { const im = a.directions[0].sprites[0].image; images[o.def.name + '/' + a.name] = { file: res[im].file, smoothed: !!res[im].smoothed }; }); });
const out = { scene: sceneName, cams: Object.fromEntries(Object.entries(cams).map(([k, v]) => [k, { x: v.x, y: v.y, zoom: v.zoom }])), layers, images,
  objects: objs.filter((o) => !o.deleted && !o.hidden).map((o) => ({ name: o.def.name, type: o.def.type, outline: !!(o.def.content && o.def.content.isOutlineEnabled), idx: o.idx, layer: o.layer, z: o.z, x: o.x, y: o.y,
    opacity: o.opacity, anim: o.anim || (o.def.animations && o.def.animations[0].name), scale: o.scale, sx: o.sx, sy: o.sy, blend: o.blend, angle: o.angle, color: o.color, text: o.text, size: o.size, ops: o.ops })) };
fs.writeFileSync(outFile, JSON.stringify(out));
const ops = out.objects.reduce((n, o) => n + o.ops.length, 0);
console.log(`volcado: ${out.objects.length} objetos visibles, ${ops} comandos de dibujo, ${frames} fotogramas -> ${outFile}`);
