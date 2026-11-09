/* UrbanMex · ui — interfaz "modo inmediato" sobre objetos de GDevelop.
 * Cada fotograma el código dibuja paneles/textos/íconos con ui.rect/ui.text/ui.icon/ui.button; los objetos
 * (Texto, Icono, UIBase, UIModal) se reutilizan de un "pool" y los que no se usan se ocultan.
 * Objetos requeridos en la escena: Texto, Icono, UIBase, UIModal (y TextoMapa, con contorno, para los nombres sobre el mapa). Capa requerida: "UI". */
(function () {
  var U = gdjs.UrbanMex, util = U.util;
  if (U.UI) return;

  var FONT = 'PressStart2P-Regular.ttf';
  var PAL = { bg: '18;14;32', panel: '26;26;46', panel2: '38;38;66', border: '255;107;53', text: '255;255;255', dim: '170;175;200',
              orange: '255;107;53', yellow: '245;197;66', green: '46;204;113', red: '231;76;60', blue: '52;152;219', purple: '155;89;182' };

  function UI(scene) {
    this.scene = scene; this.pool = { t: {}, i: {} }; this.used = {};
    this.base = scene.createObject('UIBase'); this.modal = scene.createObject('UIModal');
    [this.base, this.modal].forEach(function (p, k) { p.setLayer('UI'); p.setPosition(0, 0); p.setZOrder(k ? 300 : 100); p.setCoordinatesRelative(false); p.setOutlineSize(0); });
    this.px = 0; this.py = 0; this.down = false; this.wasDown = false; this.pressed = false; this.released = false;
    this.consumed = false; this.blocking = false; this.wheel = 0; this.hover = null; this.mob = false; this.buttons = []; this.touches = []; this.touch = false; this.lastX = -1; this.lastY = -1;
  }
  var P = UI.prototype;

  P.begin = function () {
    var inp = this.scene.getGame().getInputManager();
    this.px = inp.getCursorX(); this.py = inp.getCursorY();
    this.down = inp.isMouseButtonPressed(0); this.released = inp.isMouseButtonReleased(0);
    this.pressed = this.down && !this.wasDown; this.wasDown = this.down;
    this.wheel = inp.getMouseWheelDelta ? inp.getMouseWheelDelta() : 0;
    // TÁCTIL: GDevelop convierte el primer toque en "ratón" (cursor + botón izquierdo); aquí se leen además todos los dedos (para pellizcar).
    // Con dedos no hay cursor que pase "por encima": el resaltado de botones y estaciones solo cuenta mientras se toca (ver P.over).
    var ids = inp.getAllTouchIdentifiers ? inp.getAllTouchIdentifiers() : [], self = this;
    this.touches = ids.map(function (id) { return { x: inp.getTouchX(id), y: inp.getTouchY(id) }; });
    if (this.touches.length) U.session.touchMode = true;
    else if (U.session.touchMode && !this.down && (this.px !== this.lastX || this.py !== this.lastY) && this.lastX >= 0) U.session.touchMode = false;   // se movió un ratón de verdad
    this.lastX = this.px; this.lastY = this.py; this.touch = U.session.touchMode === true;
    this.consumed = false; this.hover = null; this.used = {}; this.buttons = []; this.mob = !!(U.Mobile && U.Mobile.active(this.scene));
    this.base.clear(); this.modal.clear();
  };

  P.end = function () {
    ['t', 'i'].forEach(function (k) {
      var pool = this.pool[k];
      for (var id in pool) if (!this.used[k + id]) pool[id].hide(true);
    }, this);
  };

  P.inside = function (x, y, w, h) { return this.px >= x && this.px <= x + w && this.py >= y && this.py <= y + h; };
  /** ¿Se resalta lo que hay bajo el puntero? Con ratón siempre; con el dedo solo mientras está apoyado. */
  P.over = function (x, y, w, h) { return this.inside(x, y, w, h) && (!this.touch || this.down); };

  /** Rectángulo con borde pixelado. o: {fill, border, bw, modal, block, alpha} */
  P.rect = function (x, y, w, h, o) {
    o = o || {}; var p = o.modal ? this.modal : this.base, bw = o.bw === undefined ? 2 : o.bw;
    if (bw > 0) { p.setFillColor(o.border || PAL.border); p.setFillOpacity(255); p.drawRectangle(x, y, x + w, y + h); }
    p.setFillColor(o.fill || PAL.panel); p.setFillOpacity(o.alpha === undefined ? 255 : o.alpha);
    p.drawRectangle(x + bw, y + bw, x + w - bw, y + h - bw);
    if (o.block && this.inside(x, y, w, h)) this.consumed = true;
  };
  P.line = function (x1, y1, x2, y2, th, color, alpha, modal) {
    var p = modal ? this.modal : this.base; p.setFillColor(color); p.setOutlineColor(color); p.setFillOpacity(alpha === undefined ? 255 : alpha);
    p.setOutlineOpacity(alpha === undefined ? 255 : alpha); p.drawLineV2(x1, y1, x2, y2, th);
  };

  function pooled(ui, kind, key, objName, layer) {
    var pool = ui.pool[kind], id = layer + ':' + key;
    var o = pool[id];
    if (!o) { o = pool[id] = ui.scene.createObject(objName); o.setLayer(layer); if (kind === 't') o.setFontName(FONT); }
    ui.used[kind + id] = true; o.hide(false); return o;
  }

  /** Texto. o: {size(8|16|24), exact (sin agrandar en modo celular), color, align:'left'|'center'|'right', z, cols (ajuste de línea), layer, opacity, lineH} */
  P.text = function (key, str, x, y, o) {
    o = o || {}; var size0 = o.size || 8, size = o.exact ? size0 : this.fs(size0), layer = o.layer === undefined ? 'UI' : o.layer;
    var t = pooled(this, 't', key, o.obj || 'Texto', layer);
    if (U.I18n) str = U.I18n.tr(str);                                                    // idioma activo (i18n.js)
    if (o.cols) str = util.wrap(str, size === size0 ? o.cols : Math.max(8, Math.floor(o.cols * size0 / size))).join('\n');
    if (t._umSize !== size) { t.setCharacterSize(size); t._umSize = size; }
    t.setText(String(str)); t.setColor(o.color || PAL.text);
    t.setOpacity(o.opacity === undefined ? 255 : o.opacity); t.setZOrder(o.z === undefined ? 200 : o.z);
    var longest = 0; String(str).split('\n').forEach(function (l) { longest = Math.max(longest, l.length); });
    var wpx = longest * size, ox = o.align === 'center' ? -wpx / 2 : o.align === 'right' ? -wpx : 0;
    t.setPosition(x + ox, y);
    return String(str).split('\n').length * (o.lineH ? Math.round(o.lineH * size / size0) : size + 4);
  };

  /** Tamaño de letra que se dibuja de verdad (en modo celular, los chicos se agrandan). */
  P.fs = function (size) { return U.Mobile ? U.Mobile.fs(size, this.mob) : size; };

  /** Varias líneas de texto, cada una en su propio objeto, con interlineado exacto (no depende de la fuente). Devuelve el alto usado. */
  P.lines = function (key, arr, x, y, o) {
    o = o || {}; var lh = o.lineH ? Math.round(o.lineH * this.fs(o.size || 8) / (o.size || 8)) : this.fs(o.size || 8) + 4;
    arr.forEach(function (l, i) { this.text(key + ':' + i, l, x, y + i * lh, o); }, this);
    return arr.length * lh;
  };

  /** Ícono (sprite 16x16 del objeto Icono). o: {tint, z, scale, layer, opacity} */
  P.icon = function (key, anim, x, y, scale, o) {
    o = o || {}; var layer = o.layer === undefined ? 'UI' : o.layer;
    var s = pooled(this, 'i', key, 'Icono', layer);
    if (s._umAnim !== anim) { s.setAnimationName(anim); s._umAnim = anim; }
    s.setScale(scale || 2); s.setPosition(x, y); s.setZOrder(o.z === undefined ? 210 : o.z);
    s.setOpacity(o.opacity === undefined ? 255 : o.opacity); s.setColor(o.tint || '255;255;255');
    return s;
  };

  /** Botón. Devuelve true si se hizo clic este fotograma. o: {fill, color, disabled, modal, size, icon} */
  P.button = function (id, label, x, y, w, h, o) {
    o = o || {}; var inb = !o.disabled && this.inside(x, y, w, h), over = inb && (!this.touch || this.down), z = o.modal ? 320 : 220;
    if (over) this.hover = id;
    this.buttons.push({ id: id, x: x, y: y, w: w, h: h, modal: !!o.modal, disabled: !!o.disabled });          // para las pruebas y la auditoría de tamaños
    var fill = o.disabled ? '50;50;70' : (over ? lighten(o.fill || PAL.orange) : (o.fill || PAL.orange));
    this.rect(x, y, w, h, { fill: fill, border: o.disabled ? '80;80;100' : '255;255;255', bw: 2, modal: o.modal, block: true });
    if (U.I18n) label = U.I18n.tr(label);
    var size = o.size || 8, real = this.fs(size);
    while (real > 8 && String(label).length * real > w - 8) real -= 4;          // el rótulo siempre cabe en el botón (en modo celular las letras son más grandes)
    var tx = x + w / 2, ty = y + (h - real) / 2 + (over && this.down ? 2 : 0);
    this.text('btn:' + id, label, tx, ty, { size: real, exact: true, align: 'center', z: z, color: o.disabled ? '120;120;140' : (o.color || '255;255;255') });
    var hit = !!(inb && this.released);
    if (hit && U.Audio) U.Audio.play(this.scene, 'click');          // clic suave (audio.js)
    return hit;
  };

  /** Barra de progreso. pct 0..1 */
  P.bar = function (x, y, w, h, pct, color, modal) {
    this.rect(x, y, w, h, { fill: '10;10;20', border: '90;90;120', bw: 2, modal: modal });
    var iw = Math.max(0, Math.floor((w - 4) * util.clamp(pct, 0, 1)));
    if (iw > 0) { var p = modal ? this.modal : this.base; p.setFillColor(color); p.setFillOpacity(255); p.drawRectangle(x + 2, y + 2, x + 2 + iw, y + h - 2); }
  };

  function lighten(c) { return c.split(';').map(function (v) { return Math.min(255, +v + 40); }).join(';'); }

  U.UI = { PAL: PAL, FONT: FONT,
    /** Una sola instancia de UI por escena. */
    of: function (scene) { return scene._umUI || (scene._umUI = new UI(scene)); } };
})();
