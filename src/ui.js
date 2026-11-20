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
    // Celular en vertical: el aviso de girar tapa todo y es lo único que recibe toques (la escena de abajo ve el puntero lejos, sin botón apretado ni dedos).
    this.rotate = !!(U.Mobile && U.Mobile.needsRotate());
    if (this.rotate) {
      this.real = { px: this.px, py: this.py, down: this.down, pressed: this.pressed, released: this.released };
      this.px = this.py = -9999; this.down = this.pressed = this.released = false; this.touches = []; this.wheel = 0;
    }
    this.base.clear(); this.modal.clear();
  };

  /** Aviso "GIRA TU CELULAR" (pantalla vertical): dibujado en tamaños que se ven de verdad aunque el lienzo se reduzca a ~0.3x. */
  P._drawRotate = function () {
    var r = this.real, M = U.Mobile, scene = this.scene, sc = Math.max(0.15, M.scale(scene));
    this.px = r.px; this.py = r.py; this.down = r.down; this.pressed = r.pressed; this.released = r.released;       // el aviso sí recibe el toque
    var big = function (real, lo, hi) { return Math.round(util.clamp(real / sc, lo, hi)); };
    var t = big(15, 20, 40), b = big(11, 18, 26), bt = big(12, 18, 32), bh = Math.round(Math.max(80, 44 / sc * 0.7)), tx = 650, w = 600, tr = function (x) { return U.I18n ? U.I18n.tr(x) : x; };
    var wrap = function (str, size) { return util.wrap(tr(str), Math.max(8, Math.floor(w / size))); };
    var tl = wrap('GIRA TU CELULAR', t), bl = wrap('El juego se ve mejor en horizontal.', b), fsOn = M.fullscreenSupported(scene);
    var head = tl.length * (t + 8) + 14 + bl.length * (b + 8) + 30, total = head + (fsOn ? 2 * bh + 24 : bh), y = Math.max(20, Math.round((720 - total) / 2)), cy = 360;
    this.rect(0, 0, 1280, 720, { fill: '14;12;30', bw: 0, modal: true, block: true });
    // dibujo: un celular vertical (rojo) → uno horizontal (verde), centrados a la izquierda
    this.rect(120, cy - 110, 130, 220, { fill: '30;30;56', border: '231;76;60', bw: 6, modal: true });
    this.line(280, cy, 350, cy, 10, '255;255;255', 255, true); this.line(350, cy, 322, cy - 26, 10, '255;255;255', 255, true); this.line(350, cy, 322, cy + 26, 10, '255;255;255', 255, true);
    this.rect(380, cy - 70, 210, 140, { fill: '30;30;56', border: '46;204;113', bw: 6, modal: true });
    var put = function (ui, key, lines, size, color) { lines.forEach(function (l, i) { ui.text(key + i, l, tx, y, { size: size, exact: true, color: color, z: 330, noTr: true }); y += size + 8; }); };
    put(this, 'rt', tl, t, PAL.orange); y += 14;
    put(this, 'rs', bl, b, PAL.text); y += 30;
    if (fsOn && this.button('rfs', '', tx, y, w, bh, { size: 8, fill: '39;174;96', modal: true })) M.toggleFullscreen(scene);
    if (fsOn) { this.text('rfsl', 'PANTALLA COMPLETA', tx + w / 2, y + (bh - bt) / 2, { size: bt, exact: true, align: 'center', z: 330 }); y += bh + 24; }
    if (this.button('rgo', '', tx, y, w, bh, { size: 8, fill: '70;70;100', modal: true })) M.dismissRotate();
    this.text('rgol', 'JUGAR ASI', tx + w / 2, y + (bh - bt) / 2, { size: bt, exact: true, align: 'center', z: 330 });
  };

  P.end = function () {
    if (this.rotate) this._drawRotate();
    ['t', 'i'].forEach(function (k) {
      var pool = this.pool[k];
      for (var id in pool) if (!this.used[k + id] && util.diff(pool[id], 'h', true)) pool[id].hide(true);
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
    if (!o) { o = pool[id] = ui.scene.createObject(objName); o._umv = { h: false }; o.setLayer(layer); if (kind === 't') o.setFontName(FONT); }
    ui.used[kind + id] = true; if (util.diff(o, 'h', false)) o.hide(false); return o;
  }

  /** Texto. o: {size(8|16|24), exact (sin agrandar en modo celular), color, align:'left'|'center'|'right', z, cols (ajuste de línea), layer, opacity, lineH} */
  P.text = function (key, str, x, y, o) {
    o = o || {}; var size0 = o.size || 8, size = o.exact ? size0 : this.fs(size0), layer = o.layer === undefined ? 'UI' : o.layer;
    var t = pooled(this, 't', key, o.obj || 'Texto', layer);
    if (U.I18n && !o.noTr) str = U.I18n.tr(str);                                          // idioma activo (i18n.js); noTr: ya viene traducido
    if (o.cols) str = util.wrap(str, size === size0 ? o.cols : Math.max(8, Math.floor(o.cols * size0 / size))).join('\n');
    // GDevelop vuelve a dibujar un texto cada vez que se llama a setColor/setCharacterSize aunque el valor sea el mismo: solo se llama si algo cambió.
    var col = o.color || PAL.text, op = o.opacity === undefined ? 255 : o.opacity, z = o.z === undefined ? 200 : o.z;
    if (util.diff(t, 'sz', size)) t.setCharacterSize(size);
    t.setText(String(str));
    if (util.diff(t, 'c', col)) t.setColor(col);
    if (util.diff(t, 'o', op)) t.setOpacity(op);
    if (util.diff(t, 'z', z)) t.setZOrder(z);
    var longest = 0; String(str).split('\n').forEach(function (l) { longest = Math.max(longest, l.length); });
    var wpx = longest * size, ox = o.align === 'center' ? -wpx / 2 : o.align === 'right' ? -wpx : 0;
    if (util.diff(t, 'x', x + ox) | util.diff(t, 'y', y)) t.setPosition(x + ox, y);
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
    var sc = scale || 2, z = o.z === undefined ? 210 : o.z, op = o.opacity === undefined ? 255 : o.opacity, tint = o.tint || '255;255;255';
    if (util.diff(s, 'sc', sc)) s.setScale(sc);
    if (util.diff(s, 'x', x) | util.diff(s, 'y', y)) s.setPosition(x, y);
    if (util.diff(s, 'z', z)) s.setZOrder(z);
    if (util.diff(s, 'o', op)) s.setOpacity(op);
    if (util.diff(s, 'c', tint)) s.setColor(tint);
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
