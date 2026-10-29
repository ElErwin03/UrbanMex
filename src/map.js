/* UrbanMex · map — mapa isométrico 2.5D del Metro (estilo Age of Empires / Clash of Clans): isla de ciudad con edificios en
 * relieve, líneas, estaciones, jugador y cámara. La cuadrícula lógica (x, y de estaciones.json) no cambia; solo se proyecta:
 *   pantalla.x = OX + (x - y) * HW        pantalla.y = OY + (x + y) * HH      (casilla = rombo de 48x24 px)
 * Objetos requeridos: Mapa, Estacion, Jugador, EdificioIso. El mapa vive en la capa base ("") y se mueve con la cámara.
 * Al empezar la cámara ENCUADRA toda la red del Metro (no hace falta mover ni acercar). */
(function () {
  var U = gdjs.UrbanMex, util = U.util;
  if (U.MapView) return;

  var HW = 24, HH = 12, OX = 480, OY = 40;                 // media casilla isométrica y origen del mundo
  var X0 = -2, X1 = 31, Y0 = -2, Y1 = 25, THICK = 20;      // casillas de la isla de la ciudad y grosor del "terreno"
  var ICON = 16, ST_SCALE = 2;
  var VIEW = { x0: 8, x1: 906, y0: 62, y1: 618 }, VIEW_NOPHONE_X1 = 1272;          // zona de pantalla libre para el mapa (sin HUD, celular ni panel inferior)
  var PAD = { l: 56, r: 56, t: 60, b: 40 };                // margen alrededor de las estaciones al encuadrar
  var BUILD = [{ h: 16, a: 0 }, { h: 28, a: 0 }, { h: 40, a: 1 }, { h: 56, a: 1 }, { h: 22, a: 0 }, { h: 34, a: 1 }];   // = tools/make_art.py

  function iso(gx, gy) { return { x: OX + (gx - gy) * HW, y: OY + (gx + gy) * HH }; }
  function wpos(st) { return iso(st.x, st.y); }
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
    this.ground = scene.createObject('Mapa'); this.routes = scene.createObject('Mapa');
    [this.ground, this.routes].forEach(function (p, k) { p.setPosition(0, 0); p.setZOrder(k ? 50 : 0); p.setCoordinatesRelative(false); p.setOutlineSize(0); });
    this.cam = { x: 0, y: 0, zoom: 1, follow: false };
    this.view = { x0: VIEW.x0, x1: VIEW.x1, y0: VIEW.y0, y1: VIEW.y1 };   // zona libre; se ensancha al ocultar el celular
    this.touched = false; this.highlight = null;                         // touched: la persona movió/acercó la cámara
    this.labelsAll = false;
    this.sprites = {}; this.player = scene.createObject('Jugador'); this.player.setZOrder(70);
    this.pp = { x: 0, y: 0 }; this.move = null; this.t = 0;
    this._bounds(); this._buildStations(); this._buildDecor(); this._paintGround(); this.fit();
  }
  var P = MapView.prototype;

  P._bounds = function () {
    var b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    this.data.stationList.forEach(function (st) { var p = wpos(st); b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y); });
    this.bbox = b;
  };

  P._buildStations = function () {
    this.data.stationList.forEach(function (st) {
      var s = this.scene.createObject('Estacion'); s.setZOrder(60); s.setScale(ST_SCALE);
      var w = wpos(st); s.setPosition(w.x - ICON * ST_SCALE / 2, w.y - ICON * ST_SCALE / 2); this.sprites[st.id] = s;
    }, this);
  };

  /** Casillas libres de ciudad (lejos de las vías) con edificios 3D o parques. Determinista: siempre igual. */
  P._buildDecor = function () {
    var rnd = util.seeded(2026), d = this.data, segs = d.connections.map(function (c) { return [d.stations[c.a], d.stations[c.b]]; });
    this.lots = [];
    for (var gx = X0; gx <= X1; gx++) for (var gy = Y0; gy <= Y1; gy++) {
      var near = 99;
      for (var i = 0; i < segs.length; i++) near = Math.min(near, distSeg(gx, gy, segs[i][0].x, segs[i][0].y, segs[i][1].x, segs[i][1].y));
      if (near < 1.05) continue;                                // calle del Metro: sin construcciones
      var c = iso(gx, gy), r = rnd(), kind = r < 0.52 ? 'b' : r < 0.60 ? 'p' : '';
      this.lots.push({ c: c, kind: kind });
      if (!kind) continue;
      var o = this.scene.createObject('EdificioIso'), z = 10 + gx + gy;
      if (kind === 'p') { o.setAnimationName('parque'); o.setPosition(c.x - 24, c.y - 24); }
      else {
        var v = near < 2.6 ? util.pick(rnd, [0, 4, 1]) : util.pick(rnd, [0, 1, 4, 2, 5, 3, 0, 4]), B = BUILD[v];   // cerca de las vías: bajos
        o.setAnimationName('b' + v); o.setPosition(c.x - 24, c.y - (B.h + 24 + (B.a ? 7 : 0) - 12));
      }
      o.setZOrder(z);
    }
  };

  /** Suelo estático (se dibuja UNA vez): neblina, isla con grosor, avenidas, manzanas y andenes de cada estación. */
  P._paintGround = function () {
    var g = this.ground, d = this.data, i;
    for (i = 0; i < 14; i++) {                                   // cielo/neblina en franjas
      var k = i / 13; fill(g, util.rgb(Math.round(12 + 14 * k), Math.round(10 + 12 * k), Math.round(26 + 24 * k)));
      g.drawRectangle(-2600, -700 + 2400 * i / 14, 3600, -700 + 2400 * (i + 1) / 14 + 2);
    }
    var T = iso(X0 - 0.5, Y0 - 0.5), R = iso(X1 + 0.5, Y0 - 0.5), B = iso(X1 + 0.5, Y1 + 0.5), L = iso(X0 - 0.5, Y1 + 0.5);
    var dn = function (p) { return { x: p.x, y: p.y + THICK }; };
    fill(g, '58;40;66'); poly(g, [L, B, dn(B), dn(L)]);          // costado izquierdo del terreno
    fill(g, '36;26;48'); poly(g, [B, R, dn(R), dn(B)]);          // costado derecho (más oscuro)
    fill(g, '30;34;60'); poly(g, [T, R, B, L]);                  // asfalto
    stroke(g, '96;96;140'); g.drawLineV2(T.x, T.y, R.x, R.y, 3); g.drawLineV2(R.x, R.y, B.x, B.y, 3); g.drawLineV2(B.x, B.y, L.x, L.y, 3); g.drawLineV2(L.x, L.y, T.x, T.y, 3);
    d.connections.forEach(function (c) {                          // avenidas bajo las vías
      var a = wpos(d.stations[c.a]), b = wpos(d.stations[c.b]); stroke(g, '22;24;44'); g.drawLineV2(a.x, a.y, b.x, b.y, 24);
    });
    this.lots.forEach(function (l) {                              // manzanas: banqueta + terreno
      fill(g, '46;52;88'); poly(g, dia(l.c, 0.98)); fill(g, l.kind === 'p' ? '38;82;58' : '58;66;104'); poly(g, dia(l.c, 0.84));
    });
    d.stationList.forEach(function (st) {                         // andén de cada estación con el color de su línea
      var c = wpos(st); fill(g, util.hex(st.color)); poly(g, dia(c, 0.82)); fill(g, '16;14;30'); poly(g, dia(c, 0.66));
    });
  };

  P.placePlayer = function (stationId) { var w = wpos(this.data.stations[stationId]); this.pp.x = w.x; this.pp.y = w.y; this.move = null; };
  P.stationPos = function (id) { return wpos(this.data.stations[id]); };

  /** Anima al jugador de la estación a a la b durante `dur` segundos. */
  P.walk = function (a, b, dur) { this.move = { a: wpos(this.data.stations[a]), b: wpos(this.data.stations[b]), t: 0, dur: dur }; };
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
    this.view.x1 = open ? VIEW.x1 : VIEW_NOPHONE_X1;
    if (!this.touched) this.fit();
  };

  /** Zoom alrededor del centro de la zona libre (el mapa no "se escapa" detrás del celular). */
  P.zoomBy = function (dz) {
    var c = this.cam, z0 = c.zoom, z1 = util.clamp(Math.round((z0 + dz) * 10) / 10, 0.5, 2.4), CX = this._cx(), CY = this._cy();
    if (z1 === z0) return;
    this.touched = true;
    var px = c.x + (CX - 640) / z0, py = c.y + (CY - 360) / z0; c.zoom = z1; c.x = px - (CX - 640) / z1; c.y = py - (CY - 360) / z1;
  };

  /** Estación bajo el puntero (coordenadas de pantalla) o null. */
  P.pick = function (sx, sy) {
    var w = this.layer.convertCoords(sx, sy, 0, [0, 0]), best = null, bd = Math.min(30, 26 / this.cam.zoom);
    this.data.stationList.forEach(function (st) {
      var p = wpos(st), dd = Math.hypot(w[0] - p.x, (w[1] - p.y) * 1.3);
      if (dd < bd) { bd = dd; best = st.id; }
    });
    return best;
  };

  P.pan = function (dxScreen, dyScreen) { this.cam.x -= dxScreen / this.cam.zoom; this.cam.y -= dyScreen / this.cam.zoom; this.cam.follow = false; this.touched = true; };

  P.update = function (dt, run, ui, hoverId, selId) {
    this.t += dt;
    if (this.move) {
      var m = this.move; m.t += dt; var k = util.clamp(m.t / m.dur, 0, 1);
      this.pp.x = util.lerp(m.a.x, m.b.x, k); this.pp.y = util.lerp(m.a.y, m.b.y, k) - Math.sin(k * Math.PI) * 6;
      if (k >= 1) { this.pp.y = m.b.y; this.move = null; }
    }
    // Jugador: 2 cuadros de "respiración"
    var pl = this.player; pl.setAnimationName(Math.floor(this.t * 3) % 2 ? 'a1' : 'a0'); pl.setScale(3);
    pl.setPosition(this.pp.x - 18, this.pp.y - 54);
    // Cámara: fija (toda la red a la vista) salvo que la persona acerque y pulse "YO"
    if (this.cam.follow) {
      var tx = this.pp.x + (640 - this._cx()) / this.cam.zoom, ty = this.pp.y + (360 - this._cy()) / this.cam.zoom - 20;
      this.cam.x = util.lerp(this.cam.x, tx, Math.min(1, dt * 6)); this.cam.y = util.lerp(this.cam.y, ty, Math.min(1, dt * 6));
    }
    this.layer.setCameraX(Math.round(this.cam.x)); this.layer.setCameraY(Math.round(this.cam.y)); this.layer.setCameraZoom(this.cam.zoom);
    this._drawRoutes(run, hoverId); this._updateStations(run, ui, hoverId, selId); this._updateCombis(run, ui);
  };

  P._drawRoutes = function (run, hoverId) {
    var r = this.routes, d = this.data, hl = this.highlight; r.clear();
    d.connections.forEach(function (c) {
      var a = d.stations[c.a], b = d.stations[c.b], pa = wpos(a), pb = wpos(b);
      var blocked = run.blocked[c.a] || run.blocked[c.b], cost = U.Rules.edgeCost(run, c.a, c.b), slow = cost > c.cost + 2;
      var col = blocked ? '120;80;150' : slow ? '231;76;60' : util.hex(a.color), op = blocked ? 90 : 255, dim = hl && a.line !== hl && b.line !== hl;
      if (dim) op = 40;                                                      // línea elegida en el celular: las demás se apagan
      if (c.combi) { dim = !!hl; op = blocked ? 70 : dim ? 40 : 255; col = blocked ? '120;80;150' : '255;170;40'; }       // rutas de combi: naranja punteado
      stroke(r, '0;0;0', dim ? 40 : 120); r.drawLineV2(pa.x, pa.y + 5, pb.x, pb.y + 5, c.transfer || c.combi ? 5 : 10);          // sombra de la vía elevada
      if (c.combi) {
        stroke(r, col, op);
        var nc = Math.max(2, Math.floor(Math.hypot(pb.x - pa.x, pb.y - pa.y) / 9));
        for (var j = 0; j < nc; j += 2) r.drawLineV2(util.lerp(pa.x, pb.x, j / nc), util.lerp(pa.y, pb.y, j / nc), util.lerp(pa.x, pb.x, (j + 1) / nc), util.lerp(pa.y, pb.y, (j + 1) / nc), 5);
      } else if (c.transfer) {   // transbordo: línea punteada
        stroke(r, '255;255;255', dim ? 40 : 170);
        var n = Math.max(2, Math.floor(Math.hypot(pb.x - pa.x, pb.y - pa.y) / 10));
        for (var i = 0; i < n; i += 2) r.drawLineV2(util.lerp(pa.x, pb.x, i / n), util.lerp(pa.y, pb.y, i / n), util.lerp(pa.x, pb.x, (i + 1) / n), util.lerp(pa.y, pb.y, (i + 1) / n), 4);
      } else { stroke(r, col, op); r.drawLineV2(pa.x, pa.y, pb.x, pb.y, 7); }
    });
    var pulse = 0.5 + 0.5 * Math.sin(this.t * 6), self = this, ring = function (p, rad, color, a) { fill(r, color, a); r.drawEllipse(p.x, p.y + 1, rad * 2, rad); };
    U.Graph.neighbors(run.graph, run.current).forEach(function (n) {   // estaciones alcanzables (pulso)
      if (!run.blocked[n]) ring(wpos(d.stations[n]), 21 + 3 * pulse, '255;255;255', 70 + 90 * pulse);
    });
    var goal = wpos(d.stations[run.level.goal]);                       // faro verde sobre la meta
    fill(r, '46;204;113', 70 + 60 * pulse); r.drawRectangle(goal.x - 3, goal.y - 78, goal.x + 3, goal.y - 6);
    ring(goal, 24 + 3 * pulse, '46;204;113', 110);
    ring(wpos(d.stations[run.current]), 27 + 3 * pulse, '255;107;53', 80 + 60 * pulse);
    if (hoverId) ring(wpos(d.stations[hoverId]), 23, '255;255;255', 90);
    fill(r, '0;0;0', 120); r.drawEllipse(self.pp.x, self.pp.y + 2, 30, 12);   // sombra del jugador
  };

  /** Un microbús sobre cada ruta de combi (como las estaciones, siempre a la vista). */
  P._updateCombis = function (run, ui) {
    var d = this.data, n = 0, hl = this.highlight;
    d.connections.forEach(function (c) {
      if (!c.combi) return;
      var pa = wpos(d.stations[c.a]), pb = wpos(d.stations[c.b]), blocked = run.blocked[c.a] || run.blocked[c.b];
      ui.icon('cb:' + (n++), 'combi', (pa.x + pb.x) / 2 - 12, (pa.y + pb.y) / 2 - 16, 1.5, { layer: '', z: 66, opacity: blocked ? 90 : hl ? 70 : 255 });
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
      var sc = ST_SCALE * (st.id === run.current ? 1.25 : st.id === hoverId || st.id === selId ? 1.15 : 1); s.setScale(sc);
      s.setPosition(p.x - ICON * sc / 2, p.y - ICON * sc / 2);
      // Nombres: solo los que importan (actual, meta, inicio, bajo el puntero, vecinas); todos con el botón NOMBRES o con zoom
      if (key || near[st.id] || this.labelsAll || zoomedIn) {
        var big = key, col = blocked ? '190;140;220' : st.id === lv.goal ? '120;255;170' : st.id === run.current ? '255;190;120' : '245;245;255';
        ui.text('lbl:' + st.id, st.id, p.x, p.y + (big ? 22 : 18), { layer: '', obj: 'TextoMapa', align: 'center', size: big ? 12 : 8, z: key ? 90 : 80, color: col });
      }
      if (st.shop && !blocked && st.id !== lv.goal) ui.icon('shp:' + st.id, 'tienda', p.x + 8, p.y - 40, 1.5, { layer: '', z: 81 });
    }, this);
  };

  U.MapView = MapView;
})();
