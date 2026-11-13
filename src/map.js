/* UrbanMex · map — mapa isométrico 2.5D del Metro (estilo Age of Empires / Clash of Clans): isla de ciudad con edificios en
 * relieve, líneas, estaciones, jugador y cámara. La cuadrícula lógica (x, y de estaciones.json) no cambia; se separa por K (U.Layout.K,
 * para que las estaciones respiren) y se proyecta:
 *   pantalla.x = OX + (x*K - y*K) * HW    pantalla.y = OY + (x*K + y*K) * HH      (casilla = rombo de 48x24 px)
 * Las líneas del Metro son rectas; las rutas secundarias (combis y transbordos) siguen las calles con codos (U.Layout.secondary).
 * Alrededor de cada estación hay una plaza despejada y la ciudad se mantiene baja, para que el mapa se lea sin saturarse.
 * Objetos requeridos: Mapa, Estacion, Jugador, EdificioIso. El mapa vive en la capa base ("") y se mueve con la cámara.
 * Al empezar la cámara ENCUADRA toda la red del Metro (no hace falta mover ni acercar). */
(function () {
  var U = gdjs.UrbanMex, util = U.util;
  if (U.MapView) return;

  var HW = 24, HH = 12, OX = 480, OY = 40;                 // media casilla isométrica y origen del mundo
  var X0 = -2, X1 = 31, Y0 = -2, Y1 = 25, THICK = 20;      // casillas de la isla de la ciudad (se recalculan según la red) y grosor del "terreno"
  var ICON = 16, ST_SCALE = 2;
  var VIEW = { x0: 8, x1: 906, y0: 62, y1: 618 }, VIEW_NOPHONE_X1 = 1272;          // zona de pantalla libre para el mapa (sin HUD, celular ni panel inferior)
  var PAD = { l: 56, r: 56, t: 76, b: 40 };
  var PLAZA = 1.9, CALM = 3.2, BUILD_P = 0.40, PARK_P = 0.10;   // despejado alrededor de cada estación (casillas), zona "tranquila" (solo edificios bajos) y densidad de la ciudad                // margen alrededor de las estaciones al encuadrar
  var BUILD = [{ h: 16, a: 0 }, { h: 28, a: 0 }, { h: 40, a: 1 }, { h: 56, a: 1 }, { h: 22, a: 0 }, { h: 34, a: 1 }];   // = tools/make_art.py

  function iso(gx, gy) { return { x: OX + (gx - gy) * HW, y: OY + (gx + gy) * HH }; }
  function wpos(st) { var k = U.Layout.K; return iso(st.x * k, st.y * k); }
  /** Puntos de pantalla de un trazado en casillas [{gx,gy}]. */
  function toScreen(pts) { return pts.map(function (p) { return iso(p.gx, p.gy); }); }
  /** Punto a la fracción t (0..1) de la longitud de una polilínea de pantalla. */
  function along(pts, t) {
    var tot = 0, i, L = [];
    for (i = 1; i < pts.length; i++) { L.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)); tot += L[i - 1]; }
    var want = util.clamp(t, 0, 1) * tot;
    for (i = 1; i < pts.length; i++) {
      if (want <= L[i - 1] || i === pts.length - 1) { var k = L[i - 1] ? util.clamp(want / L[i - 1], 0, 1) : 0; return { x: util.lerp(pts[i - 1].x, pts[i].x, k), y: util.lerp(pts[i - 1].y, pts[i].y, k) }; }
      want -= L[i - 1];
    }
    return { x: pts[0].x, y: pts[0].y };
  }
  /** Trazo de una polilínea con segmentos sólidos (dy: desplazamiento vertical para sombras). */
  function line(g, pts, w, dy) { dy = dy || 0; for (var i = 1; i < pts.length; i++) g.drawLineV2(pts[i - 1].x, pts[i - 1].y + dy, pts[i].x, pts[i].y + dy, w); }
  /** Trazo punteado a lo largo de una polilínea: `dash` px de raya y `gap` px de hueco, sin cortar en los codos. */
  function dashed(g, pts, dash, gap, w) {
    var on = true, left = dash, i;
    for (i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), at = 0;
      while (at < L - 1e-6) {
        var step = Math.min(left, L - at), t0 = at / L, t1 = (at + step) / L;
        if (on) g.drawLineV2(util.lerp(a.x, b.x, t0), util.lerp(a.y, b.y, t0), util.lerp(a.x, b.x, t1), util.lerp(a.y, b.y, t1), w);
        at += step; left -= step;
        if (left <= 1e-6) { on = !on; left = on ? dash : gap; }
      }
    }
  }
  function distSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? util.clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  /** Rellena un polígono (verificado en el runtime: beginFillPath / drawPathLineTo / closePath / endFillPath). */
  function poly(g, pts) {
    g.beginFillPath(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) g.drawPathLineTo(pts[i].x, pts[i].y);
    g.closePath(); g.endFillPath();
  }
  /** Rombo de una casilla centrado en c; s = 1 ocupa la casilla completa. */
  function dia(c, s, dy) { dy = dy || 0; return [{ x: c.x, y: c.y - s * HH + dy }, { x: c.x + s * HW, y: c.y + dy }, { x: c.x, y: c.y + s * HH + dy }, { x: c.x - s * HW, y: c.y + dy }]; }
  function fill(g, color, a) { g.setFillColor(color); g.setFillOpacity(a === undefined ? 255 : a); }
  function stroke(g, color, a) { g.setFillColor(color); g.setOutlineColor(color); g.setFillOpacity(a === undefined ? 255 : a); g.setOutlineOpacity(a === undefined ? 255 : a); }

  function MapView(scene, data) {
    this.scene = scene; this.data = data; this.layer = scene.getLayer('');
    this.ground = scene.createObject('Mapa'); this.routes = scene.createObject('Mapa'); this.pulse = scene.createObject('Mapa');
    this.routeSig = null;                                                  // firma de lo que muestran las rutas: solo se vuelven a dibujar si cambia (ver _drawRoutes)
    [this.ground, this.routes, this.pulse].forEach(function (p, k) { p.setPosition(0, 0); p.setZOrder(k ? 49 + k : 0); p.setCoordinatesRelative(false); p.setOutlineSize(0); });
    this.cam = { x: 0, y: 0, zoom: 1, follow: false };
    this.view = { x0: VIEW.x0, x1: VIEW.x1, y0: VIEW.y0, y1: VIEW.y1 };   // zona libre; se ensancha al ocultar el celular
    this.touched = false; this.highlight = null;                         // touched: la persona movió/acercó la cámara
    this.labelsAll = false;
    this.sprites = {}; this.player = scene.createObject('Jugador'); this.player.setZOrder(70);
    this.pp = { x: 0, y: 0 }; this.move = null; this.t = 0;
    var B = U.Layout.bounds(data); X0 = B.x0; X1 = B.x1; Y0 = B.y0; Y1 = B.y1;   // la isla abarca la red + un margen
    this._buildPaths(); this._bounds(); this._buildStations(); this._buildDecor(); this._paintGround(); this.fit();
  }
  var P = MapView.prototype;

  /** Trazado de cada conexión: el Metro va recto de estación a estación; combis y transbordos siguen las calles (U.Layout.secondary).
   *  path.g = casillas [{gx,gy}], path.s = puntos de pantalla, ambos de c.a a c.b. */
  P._buildPaths = function () {
    var d = this.data, sec = {}, L = U.Layout;
    L.secondary(d).forEach(function (r) { sec[U.Graph.key(r.conn.a, r.conn.b)] = r.pts; });
    this.paths = d.connections.map(function (c) {
      var g = c.combi || c.transfer ? sec[U.Graph.key(c.a, c.b)] : L.straight(d, c);
      return { c: c, g: g, s: toScreen(g), main: !(c.combi || c.transfer) };
    });
    this.pathOf = {}; this.paths.forEach(function (p) { this.pathOf[U.Graph.key(p.c.a, p.c.b)] = p; }, this);
  };
  /** Puntos de pantalla del recorrido de a hacia b (una ruta guardada de b a a se invierte). */
  P.route = function (a, b) {
    var p = this.pathOf[U.Graph.key(a, b)];
    if (!p) return [wpos(this.data.stations[a]), wpos(this.data.stations[b])];
    return p.c.a === a ? p.s : p.s.slice().reverse();
  };

  P._bounds = function () {
    var b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }, add = function (p) { b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y); };
    this.data.stationList.forEach(function (st) { add(wpos(st)); });
    this.paths.forEach(function (p) { p.s.forEach(add); });          // las rutas con codos pueden salirse un poco de las estaciones
    this.bbox = b;
  };

  P._buildStations = function () {
    this.data.stationList.forEach(function (st) {
      var s = this.scene.createObject('Estacion'); s.setZOrder(60); s.setScale(ST_SCALE);
      var w = wpos(st); s.setPosition(w.x - ICON * ST_SCALE / 2, w.y - ICON * ST_SCALE / 2); this.sprites[st.id] = s;
    }, this);
  };

  /** Casillas libres de ciudad con edificios 3D o parques. Las calles (todas las rutas) quedan libres, cada estación tiene una plaza despejada
   *  (PLAZA) y a su alrededor (CALM) solo hay edificios bajos y parques. Determinista: siempre igual. */
  P._buildDecor = function () {
    var rnd = util.seeded(2026), d = this.data, K = U.Layout.K, segs = [], sts = d.stationList.map(function (st) { return { x: st.x * K, y: st.y * K }; });
    this.paths.forEach(function (p) { for (var i = 1; i < p.g.length; i++) segs.push([p.g[i - 1], p.g[i]]); });
    this.lots = [];
    for (var gx = X0; gx <= X1; gx++) for (var gy = Y0; gy <= Y1; gy++) {
      var near = 99, plaza = 99, i;
      for (i = 0; i < segs.length; i++) near = Math.min(near, distSeg(gx, gy, segs[i][0].gx, segs[i][0].gy, segs[i][1].gx, segs[i][1].gy));
      if (near < 1.05) continue;                                // calle (Metro, combi o transbordo): sin construcciones
      for (i = 0; i < sts.length; i++) plaza = Math.min(plaza, Math.hypot(gx - sts[i].x, gy - sts[i].y));
      var c = iso(gx, gy), r = rnd(), kind = r < BUILD_P ? 'b' : r < BUILD_P + PARK_P ? 'p' : '';
      if (plaza < PLAZA) kind = '';                             // plaza de la estación: sin edificios ni parques
      var lot = { c: c, kind: kind, h: 0, plaza: plaza < PLAZA }; this.lots.push(lot);   // h: altura del edificio (para su sombra); 0 = sin edificio
      if (!kind) continue;
      var o = this.scene.createObject('EdificioIso'), z = 10 + (gx + gy) * 0.4;   // siempre por debajo de las vías (50) y las estaciones (60)
      if (kind === 'p') { o.setAnimationName('parque'); o.setPosition(c.x - 24, c.y - 24); }
      else {
        var v = plaza < CALM ? util.pick(rnd, [0, 4]) : near < 2.6 ? util.pick(rnd, [0, 4, 1]) : util.pick(rnd, [0, 1, 4, 2, 5, 3, 0, 4]), B = BUILD[v];   // cerca de estaciones y vías: bajos
        o.setAnimationName('b' + v); o.setPosition(c.x - 24, c.y - (B.h + 24 + (B.a ? 7 : 0) - 12)); lot.h = B.h;
      }
      o.setZOrder(z);
    }
  };

  function mixc(a, b, t) { return Math.round(a[0] + (b[0] - a[0]) * t) + ';' + Math.round(a[1] + (b[1] - a[1]) * t) + ';' + Math.round(a[2] + (b[2] - a[2]) * t); }
  function lighten(col, k) { return col.split(';').map(function (v) { return Math.round(+v + (255 - v) * k); }).join(';'); }
  /** Envolvente convexa (cadena monótona): la sombra de un edificio = su base y la base desplazada, unidas. */
  function hull(pts) {
    var p = pts.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; }), cr = function (o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }, lo = [], up = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    lo.pop(); up.pop(); return lo.concat(up);
  }

  /** Suelo estático (se dibuja UNA vez): neblina, isla con grosor y sombra, asfalto con degradado y grano, avenidas con bordillo, manzanas con
   *  relieve, sombras suaves de los edificios (luz desde la izquierda), charcos de luz bajo las estaciones y andenes con brillo. */
  P._paintGround = function () {
    var g = this.ground, d = this.data, i, j, rnd = util.seeded(404);
    for (i = 0; i < 48; i++) {                                   // cielo/neblina en franjas (48 = degradado sin escalones visibles)
      var k = i / 47; fill(g, util.rgb(Math.round(12 + 14 * k), Math.round(10 + 12 * k), Math.round(26 + 24 * k)));
      g.drawRectangle(-2600, -700 + 2400 * i / 48, 3600, -700 + 2400 * (i + 1) / 48 + 2);
    }
    var T = iso(X0 - 0.5, Y0 - 0.5), R = iso(X1 + 0.5, Y0 - 0.5), B = iso(X1 + 0.5, Y1 + 0.5), L = iso(X0 - 0.5, Y1 + 0.5);
    var cx = (T.x + B.x) / 2, cy = (T.y + B.y) / 2, hw = (R.x - L.x) / 2, hh = (B.y - T.y) / 2;
    var grow = function (p, s, dy) { return { x: cx + (p.x - cx) * s, y: cy + (p.y - cy) * s + dy }; };
    [[1.0, 34], [1.035, 24], [1.07, 16]].forEach(function (a) {   // sombra de la isla sobre la neblina (profundidad)
      fill(g, '4;3;12', a[1]); poly(g, [T, R, B, L].map(function (p) { return grow(p, a[0], THICK + 10); }));
    });
    var S = 4;
    for (i = 0; i < S; i++) {                                     // costados del terreno con degradado vertical (más oscuros abajo)
      var f0 = i / S, f1 = (i + 1) / S, dy0 = THICK * f0, dy1 = THICK * f1 + (i === S - 1 ? 0 : 1);
      fill(g, mixc([66, 46, 76], [40, 28, 54], f0)); poly(g, [{ x: L.x, y: L.y + dy0 }, { x: B.x, y: B.y + dy0 }, { x: B.x, y: B.y + dy1 }, { x: L.x, y: L.y + dy1 }]);   // izquierdo (luz)
      fill(g, mixc([40, 30, 54], [20, 14, 32], f0)); poly(g, [{ x: B.x, y: B.y + dy0 }, { x: R.x, y: R.y + dy0 }, { x: R.x, y: R.y + dy1 }, { x: B.x, y: B.y + dy1 }]);   // derecho (sombra)
    }
    fill(g, '30;34;60'); poly(g, [T, R, B, L]);                  // asfalto
    var ty = function (x) { return cy - hh * (1 - Math.abs(x - cx) / hw); }, by = function (x) { return cy + hh * (1 - Math.abs(x - cx) / hw); };
    for (i = 0; i < 12; i++) {                                    // degradado de luz: más clara a la izquierda, más oscura a la derecha
      var xa = L.x + 2 * hw * i / 12, xb = L.x + 2 * hw * (i + 1) / 12, up = [{ x: xa, y: ty(xa) }], dn2 = [{ x: xa, y: by(xa) }], mid = xa < cx && xb > cx;
      if (mid) { up.push({ x: cx, y: T.y }); dn2.push({ x: cx, y: B.y }); }
      up.push({ x: xb, y: ty(xb) }); dn2.push({ x: xb, y: by(xb) });
      var tt = (i - 5.5) / 5.5; fill(g, tt < 0 ? '130;140;210' : '0;0;12', Math.round(Math.abs(tt) * (tt < 0 ? 16 : 28)));
      poly(g, up.concat(dn2.reverse()));
    }
    for (i = 0; i < 36; i++) {                                    // manchas de desgaste del asfalto
      var sp = iso(X0 - 0.5 + rnd() * (X1 - X0 + 1), Y0 - 0.5 + rnd() * (Y1 - Y0 + 1)); fill(g, '10;10;24', 26); g.drawEllipse(sp.x, sp.y, 30 + rnd() * 40, 12 + rnd() * 14);
    }
    for (i = 0; i < 1100; i++) {                                  // grano: gravilla clara y oscura
      var gp = iso(X0 - 0.5 + rnd() * (X1 - X0 + 1), Y0 - 0.5 + rnd() * (Y1 - Y0 + 1));
      fill(g, rnd() < 0.5 ? '18;20;38' : '58;64;104', 70 + Math.floor(rnd() * 70)); g.drawRectangle(gp.x, gp.y, gp.x + 2, gp.y + 1);
    }
    stroke(g, '96;96;140'); g.drawLineV2(T.x, T.y, R.x, R.y, 3); g.drawLineV2(R.x, R.y, B.x, B.y, 3); g.drawLineV2(B.x, B.y, L.x, L.y, 3); g.drawLineV2(L.x, L.y, T.x, T.y, 3);
    stroke(g, '170;176;230', 150); g.drawLineV2(L.x, L.y, T.x, T.y, 1.5); g.drawLineV2(T.x, T.y, R.x, R.y, 1.5);   // brillo rasante en los bordes que miran a la luz
    this.paths.forEach(function (p) {                             // avenidas del Metro bajo las vías: bordillo claro y asfalto oscuro
      if (!p.main) return;
      stroke(g, '70;78;128', 120); g.drawLineV2(p.s[0].x, p.s[0].y, p.s[1].x, p.s[1].y, 30);
    });
    this.paths.forEach(function (p) {
      if (!p.main) return;
      stroke(g, '22;24;44'); g.drawLineV2(p.s[0].x, p.s[0].y, p.s[1].x, p.s[1].y, 24);
    });
    this.paths.forEach(function (p) {                             // calles de combis y transbordos: más angostas, opacas y con codos redondeados
      if (p.main) return;
      var rd = function (col, w) { stroke(g, col); line(g, p.s, w); p.s.slice(1, -1).forEach(function (q) { g.drawCircle(q.x, q.y, w / 2); }); };
      rd('49;55;92', 20); rd('22;24;44', 15);
    });
    var lots = this.lots;
    lots.forEach(function (l) {                                   // manzanas: banqueta + terreno con relieve y textura
      fill(g, '46;52;88'); poly(g, dia(l.c, 0.98));
      if (l.kind === 'b') return;                                 // con edificio: el sprite tapa todo el terreno, no hace falta pintarlo
      fill(g, l.kind === 'p' ? '38;82;58' : l.plaza ? '64;72;112' : '58;66;104'); poly(g, dia(l.c, 0.84));   // las plazas, algo más claras
      var q = dia(l.c, 0.84);
      stroke(g, '130;142;200', 130); g.drawLineV2(q[3].x, q[3].y, q[0].x, q[0].y, 2); stroke(g, '100;110;164', 100); g.drawLineV2(q[0].x, q[0].y, q[1].x, q[1].y, 2);   // luz rasante
      stroke(g, '18;20;40', 130); g.drawLineV2(q[1].x, q[1].y, q[2].x, q[2].y, 2); g.drawLineV2(q[2].x, q[2].y, q[3].x, q[3].y, 2);                                       // sombra
      var n = l.kind === 'p' ? 8 : 3;
      for (var m = 0; m < n; m++) {                               // granos de la banqueta / briznas de césped
        var a = 0, b = 0; do { a = (rnd() * 2 - 1) * 0.78; b = (rnd() * 2 - 1) * 0.78; } while (Math.abs(a) + Math.abs(b) > 0.78);
        fill(g, l.kind === 'p' ? (rnd() < 0.5 ? '78;148;96' : '26;62;42') : (rnd() < 0.5 ? '84;94;140' : '40;46;80'), 130);
        g.drawRectangle(l.c.x + a * HW, l.c.y + b * HH, l.c.x + a * HW + 2, l.c.y + b * HH + 2);
      }
    });
    lots.forEach(function (l) {                                   // sombras suaves de los edificios: caen hacia la derecha y abajo (luz desde la izquierda)
      if (!l.h) return;
      var tx = l.h * 0.62, ty2 = l.h * 0.26;
      [[1.12, 0.55, 20], [1.0, 0.8, 26], [0.9, 1.0, 34]].forEach(function (s) {   // penumbra → núcleo
        var c1 = { x: l.c.x + tx * s[1], y: l.c.y + ty2 * s[1] };
        fill(g, '4;4;18', s[2]); poly(g, hull(dia(l.c, 0.92 * s[0]).concat(dia(c1, 0.92 * s[0]))));
      });
    });
    d.stationList.forEach(function (st) {                         // charco de luz de la estación sobre el asfalto
      var c = wpos(st), col = util.hex(st.color);
      [[78, 12], [58, 16], [42, 22]].forEach(function (r) { fill(g, col, r[1]); g.drawEllipse(c.x, c.y + 2, r[0], r[0] / 2); });
    });
    d.stationList.forEach(function (st) {                         // andén de cada estación con el color de su línea y brillo en el borde de arriba
      var c = wpos(st), q = dia(c, 0.82); fill(g, util.hex(st.color)); poly(g, q); fill(g, '16;14;30'); poly(g, dia(c, 0.66));
      stroke(g, '255;255;255', 90); g.drawLineV2(q[3].x, q[3].y, q[0].x, q[0].y, 2); g.drawLineV2(q[0].x, q[0].y, q[1].x, q[1].y, 2);
    });
  };

  P.placePlayer = function (stationId) { var w = wpos(this.data.stations[stationId]); this.pp.x = w.x; this.pp.y = w.y; this.move = null; };
  P.stationPos = function (id) { return wpos(this.data.stations[id]); };

  /** Anima al jugador de la estación a a la b durante `dur` segundos. */
  P.walk = function (a, b, dur) { this.move = { path: this.route(a, b), t: 0, dur: dur }; };
  P.moving = function () { return !!this.move; };

  // ---- cámara -------------------------------------------------------------------------------------------------------
  P._cx = function () { return (this.view.x0 + this.view.x1) / 2; };   // centro de la zona libre en pantalla
  P._cy = function () { return (this.view.y0 + this.view.y1) / 2; };
  P._center = function (wx, wy) { this.cam.x = wx + (640 - this._cx()) / this.cam.zoom; this.cam.y = wy + (360 - this._cy()) / this.cam.zoom; };

  /** Encuadra TODA la red del Metro en la zona libre de pantalla. */
  P.fit = function () {
    var b = this.bbox, v = this.view, w = b.x1 - b.x0 + PAD.l + PAD.r, h = b.y1 - b.y0 + PAD.t + PAD.b;
    this.cam.zoom = Math.floor(100 * Math.min(1, (v.x1 - v.x0) / w, (v.y1 - v.y0) / h)) / 100; this.cam.follow = false; this.touched = false;
    this.fitZoom = this.cam.zoom; this._center((b.x0 - PAD.l + b.x1 + PAD.r) / 2, (b.y0 - PAD.t + b.y1 + PAD.b) / 2);
  };
  P.followPlayer = function () { this.cam.follow = true; this.touched = true; };

  /** El celular ocupa la derecha de la pantalla: si se oculta, la red se centra en todo el ancho. */
  P.setPhoneOpen = function (open) {
    this.view.x1 = open ? (this.phoneX1 || VIEW.x1) : VIEW_NOPHONE_X1;   // phoneX1: borde izquierdo del celular (más a la izquierda en modo celular)
    if (!this.touched) this.fit();
  };

  /** Zoom alrededor del centro de la zona libre (el mapa no "se escapa" detrás del celular). */
  P.zoomBy = function (dz) {
    var c = this.cam, z0 = c.zoom, z1 = util.clamp(Math.round((z0 + dz) * 10) / 10, 0.5, 2.4), CX = this._cx(), CY = this._cy();
    if (z1 === z0) return;
    this.touched = true;
    var px = c.x + (CX - 640) / z0, py = c.y + (CY - 360) / z0; c.zoom = z1; c.x = px - (CX - 640) / z1; c.y = py - (CY - 360) / z1;
  };

  /** Pellizcar con dos dedos: el punto del mapa que está entre los dedos al empezar se queda entre ellos mientras se acercan o se alejan (y al arrastrar, el mapa los sigue). */
  P.pinchStart = function (sx, sy) {
    var c = this.cam; this._pin = { wx: c.x + (sx - 640) / c.zoom, wy: c.y + (sy - 360) / c.zoom, z0: c.zoom };
    c.follow = false; this.touched = true;
  };
  P.pinchMove = function (scale, sx, sy) {
    var p = this._pin; if (!p) return;
    var c = this.cam, z = util.clamp(p.z0 * scale, 0.5, 2.4); c.zoom = z; c.x = p.wx - (sx - 640) / z; c.y = p.wy - (sy - 360) / z;
  };
  P.pinchEnd = function () { this._pin = null; };
  P.pinching = function () { return !!this._pin; };

  /** Estación bajo el puntero (coordenadas de pantalla) o null. `touch`: con el dedo el área para acertar es más grande. */
  P.pick = function (sx, sy, touch) {
    var w = this.layer.convertCoords(sx, sy, 0, [0, 0]), best = null, bd = touch ? Math.min(60, 46 / this.cam.zoom) : Math.min(30, 26 / this.cam.zoom);
    this.data.stationList.forEach(function (st) {
      var p = wpos(st), dd = Math.hypot(w[0] - p.x, (w[1] - p.y) * 1.3);
      if (dd < bd) { bd = dd; best = st.id; }
    });
    return best;
  };

  P.pan = function (dxScreen, dyScreen) { this.cam.x -= dxScreen / this.cam.zoom; this.cam.y -= dyScreen / this.cam.zoom; this.cam.follow = false; this.touched = true; };

  /** Sacude el mapa `amp` píxeles durante `dur` segundos (se apaga solo). */
  P.kick = function (amp, dur) { this.kickFx = { t: 0, dur: dur, amp: amp }; };

  P.update = function (dt, run, ui, hoverId, selId) {
    this.t += dt;
    if (this.move) {
      var m = this.move; m.t += dt; var k = util.clamp(m.t / m.dur, 0, 1);
      var at = along(m.path, k); this.pp.x = at.x; this.pp.y = at.y - Math.sin(k * Math.PI) * 6;      // sigue el recorrido (con codos en combis y transbordos)
      if (k >= 1) { var end = m.path[m.path.length - 1]; this.pp.x = end.x; this.pp.y = end.y; this.move = null; }
    }
    // Jugador: 2 cuadros de "respiración"
    var pl = this.player, pa = Math.floor(this.t * 3) % 2 ? 'a1' : 'a0';
    if (util.diff(pl, 'an', pa)) pl.setAnimationName(pa);
    if (util.diff(pl, 'sc', 3)) pl.setScale(3);
    if (util.diff(pl, 'x', this.pp.x - 18) | util.diff(pl, 'y', this.pp.y - 54)) pl.setPosition(this.pp.x - 18, this.pp.y - 54);
    // Cámara: fija (toda la red a la vista) salvo que la persona acerque y pulse "YO"
    if (this.cam.follow) {
      var tx = this.pp.x + (640 - this._cx()) / this.cam.zoom, ty = this.pp.y + (360 - this._cy()) / this.cam.zoom - 20;
      this.cam.x = util.lerp(this.cam.x, tx, Math.min(1, dt * 6)); this.cam.y = util.lerp(this.cam.y, ty, Math.min(1, dt * 6));
    }
    var sx = 0, sy = 0, k = this.kickFx;                                  // sacudida (asalto): oscila y se apaga; solo mueve el mapa, no la interfaz
    if (k) { k.t += dt; if (k.t >= k.dur) this.kickFx = null; else { var f = 1 - k.t / k.dur; sx = Math.sin(k.t * 71) * k.amp * f * f; sy = Math.cos(k.t * 59) * k.amp * 0.7 * f * f; } }
    this.shakeNow = { x: sx, y: sy };
    this.layer.setCameraX(Math.round(this.cam.x + sx)); this.layer.setCameraY(Math.round(this.cam.y + sy)); this.layer.setCameraZoom(this.cam.zoom);
    this._drawRoutes(run, hoverId); this._updateStations(run, ui, hoverId, selId); this._updateCombis(run, ui);
  };

  /**
   * Las vías (cientos de trazos) cambian muy rara vez: se dibujan en `routes` solo cuando cambia su firma (estación bloqueada, tramo lento o línea
   * elegida), porque GDevelop vuelve a triangular todo el Shape Painter cada vez que se borra y se redibuja. Lo que sí se mueve en cada fotograma
   * (pulsos, faro, sombra) va aparte, en `pulse`, que tiene unos cuantos trazos.
   */
  P._drawRoutes = function (run, hoverId) {
    var hl = this.highlight, state = this.paths.map(function (p) {
      var c = p.c, blocked = run.blocked[c.a] || run.blocked[c.b];
      return (blocked ? 2 : 0) + (U.Rules.edgeCost(run, c.a, c.b) > c.cost + 2 ? 1 : 0);
    }), sig = (hl || '') + '|' + state.join('');
    if (sig !== this.routeSig) { this.routeSig = sig; this._drawTracks(run, state); }
    this._drawPulses(run, hoverId);
  };

  P._drawTracks = function (run, state) {
    var r = this.routes, d = this.data, hl = this.highlight; r.clear();
    this.paths.forEach(function (p, i) {
      var c = p.c, a = d.stations[c.a], b = d.stations[c.b], pts = p.s;
      var blocked = state[i] >= 2, slow = (state[i] & 1) === 1;
      var col = blocked ? '120;80;150' : slow ? '231;76;60' : util.hex(a.color), op = blocked ? 90 : 255, dim = hl && a.line !== hl && b.line !== hl;
      if (dim) op = 40;                                                      // línea elegida en el celular: las demás se apagan
      if (c.combi) { dim = !!hl; op = blocked ? 70 : dim ? 40 : 255; col = blocked ? '120;80;150' : '255;170;40'; }       // rutas de combi: naranja punteado
      var thick = c.transfer || c.combi ? 5 : 10;
      stroke(r, '0;0;0', dim ? 14 : 44); line(r, pts, thick + 8, 7);                                                          // sombra de la vía elevada: penumbra...
      stroke(r, '0;0;0', dim ? 26 : 84); line(r, pts, thick, 5);                                                              // ...y núcleo
      if (c.combi) { stroke(r, col, op); dashed(r, pts, 9, 8, 5); }
      else if (c.transfer) { stroke(r, '255;255;255', dim ? 40 : 170); dashed(r, pts, 10, 9, 4); }                              // transbordo: línea punteada
      else {
        stroke(r, col, Math.round(op * 0.16)); line(r, pts, 15);                                                              // halo de luz de la línea
        stroke(r, col, op); line(r, pts, 7);
        stroke(r, lighten(col, 0.55), Math.round(op * 0.5)); line(r, pts, 2, -1.5);                                          // reflejo en el riel (luz desde arriba)
      }
    });
  };

  P._drawPulses = function (run, hoverId) {
    var r = this.pulse, d = this.data; r.clear();
    var pulse = 0.5 + 0.5 * Math.sin(this.t * 6), self = this, ring = function (p, rad, color, a) { fill(r, color, a); r.drawEllipse(p.x, p.y + 1, rad * 2, rad); };
    U.Graph.neighbors(run.graph, run.current).forEach(function (n) {   // estaciones alcanzables (pulso)
      if (!run.blocked[n]) ring(wpos(d.stations[n]), 21 + 3 * pulse, '255;255;255', 70 + 90 * pulse);
    });
    var goal = wpos(d.stations[run.level.goal]);                       // faro verde sobre la meta
    fill(r, '46;204;113', 70 + 60 * pulse); r.drawRectangle(goal.x - 3, goal.y - 78, goal.x + 3, goal.y - 6);
    ring(goal, 24 + 3 * pulse, '46;204;113', 110);
    ring(wpos(d.stations[run.current]), 27 + 3 * pulse, '255;107;53', 80 + 60 * pulse);
    if (hoverId) ring(wpos(d.stations[hoverId]), 23, '255;255;255', 90);
    if (!self.softShadow) { fill(r, '0;0;0', 120); r.drawEllipse(self.pp.x, self.pp.y + 2, 30, 12); }   // sombra del jugador (con efectos la dibuja fx.js, suave)
  };

  /** Un microbús sobre cada ruta de combi (como las estaciones, siempre a la vista). */
  P._updateCombis = function (run, ui) {
    var d = this.data, n = 0, hl = this.highlight;
    this.paths.forEach(function (p) {
      if (!p.c.combi) return;
      var m = along(p.s, 0.5), blocked = run.blocked[p.c.a] || run.blocked[p.c.b];       // a mitad del recorrido
      ui.icon('cb:' + (n++), 'combi', m.x - 12, m.y - 16, 1.5, { layer: '', z: 66, opacity: blocked ? 90 : hl ? 70 : 255 });
    });
  };

  P._updateStations = function (run, ui, hoverId, selId) {
    var d = this.data, lv = run.level, near = {}, zoomedIn = this.cam.zoom >= 1.4;
    U.Graph.neighbors(run.graph, run.current).forEach(function (n) { near[n] = true; });
    d.stationList.forEach(function (st) {
      var s = this.sprites[st.id], p = wpos(st), blocked = run.blocked[st.id], key = st.id === run.current || st.id === lv.goal || st.id === lv.start || st.id === hoverId || st.id === selId;
      var anim = st.id === lv.goal ? 'meta' : blocked ? 'bloqueada' : st.id === lv.start ? 'inicio' : st.shop ? 'tienda' : 'normal';
      if (s._umAnim !== anim) { s.setAnimationName(anim); s._umAnim = anim; }
      var tint = st.id === lv.goal ? '46;204;113' : blocked ? '155;89;182' : st.shop ? '90;170;255' : util.hex(st.color);
      if (this.highlight && st.line !== this.highlight && !key) tint = '70;72;92';              // estaciones de las otras líneas, apagadas
      if (s._umTint !== tint) { s.setColor(tint); s._umTint = tint; }
      var sc = ST_SCALE * (st.id === run.current ? 1.25 : st.id === hoverId || st.id === selId ? 1.15 : 1);
      if (util.diff(s, 'sc', sc)) s.setScale(sc);
      if (util.diff(s, 'x', p.x - ICON * sc / 2) | util.diff(s, 'y', p.y - ICON * sc / 2)) s.setPosition(p.x - ICON * sc / 2, p.y - ICON * sc / 2);
      // Nombres: solo los que importan (actual, meta, inicio, bajo el puntero, vecinas); todos con el botón NOMBRES o con zoom
      if (key || near[st.id] || this.labelsAll || zoomedIn) {
        var big = key, col = blocked ? '190;140;220' : st.id === lv.goal ? '120;255;170' : st.id === run.current ? '255;190;120' : '245;245;255';
        var ls = util.clamp(1 / this.cam.zoom, 1, 1.35);                                    // con la red entera a escala menor, los nombres crecen un poco para seguir legibles
        ui.text('lbl:' + st.id, st.id, p.x, p.y + (big ? 22 : 18), { layer: '', obj: 'TextoMapa', align: 'center', size: Math.round((big ? 12 : 8) * ls), z: key ? 90 : 80, color: col });
      }
      if (st.shop && !blocked && st.id !== lv.goal) ui.icon('shp:' + st.id, 'tienda', p.x + 8, p.y - 40, 1.5, { layer: '', z: 81 });
    }, this);
  };

  U.MapView = MapView;
})();
