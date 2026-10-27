/* UrbanMex · map — mapa 2D del Metro (vista cenital pixel-art): suelo, edificios, líneas, estaciones, jugador y cámara.
 * Objetos requeridos: Mapa, Estacion, Jugador, Edificio. El mapa vive en la capa base ("") y se mueve con la cámara. */
(function () {
  var U = gdjs.UrbanMex, util = U.util, UIm = U.UI;
  if (U.MapView) return;

  var TILE = 56, OX = 64, OY = 64, COLS = 32, ROWS = 27, ICON = 16, ST_SCALE = 2;

  function wpos(st) { return { x: OX + st.x * TILE, y: OY + st.y * TILE }; }
  function distSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? util.clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function MapView(scene, data) {
    this.scene = scene; this.data = data; this.layer = scene.getLayer('');
    this.ground = scene.createObject('Mapa'); this.routes = scene.createObject('Mapa');
    [this.ground, this.routes].forEach(function (p, k) { p.setPosition(0, 0); p.setZOrder(k ? 50 : 0); p.setCoordinatesRelative(false); p.setOutlineSize(0); });
    this.cam = { x: 0, y: 0, zoom: 1, follow: true };
    this.sprites = {}; this.player = scene.createObject('Jugador'); this.player.setZOrder(70);
    this.pp = { x: 0, y: 0 }; this.move = null; this.t = 0;
    this._buildStations(); this._buildDecor();
  }
  var P = MapView.prototype;

  P._buildStations = function () {
    this.data.stationList.forEach(function (st) {
      var s = this.scene.createObject('Estacion'); s.setZOrder(60); s.setScale(ST_SCALE);
      var w = wpos(st); s.setPosition(w.x - ICON * ST_SCALE / 2, w.y - ICON * ST_SCALE / 2); this.sprites[st.id] = s;
    }, this);
  };

  /** Edificios decorativos en las manzanas libres (determinista: siempre igual). */
  P._buildDecor = function () {
    var rnd = util.seeded(2026), d = this.data, segs = d.connections.map(function (c) {
      return [wpos(d.stations[c.a]), wpos(d.stations[c.b])];
    });
    this.decor = [];
    for (var gx = 0; gx < COLS; gx++) for (var gy = 0; gy < ROWS; gy++) {
      var cx = OX + gx * TILE, cy = OY + gy * TILE, near = false;
      for (var i = 0; i < segs.length && !near; i++) near = distSeg(cx, cy, segs[i][0].x, segs[i][0].y, segs[i][1].x, segs[i][1].y) < TILE * 0.95;
      if (near || rnd() > 0.34) continue;
      var b = this.scene.createObject('Edificio'); b.setAnimationName('e' + Math.floor(rnd() * 4)); b.setScale(2);
      b.setPosition(cx - 24, cy - 40); b.setZOrder(1 + Math.floor(cy / 70)); this.decor.push(b);
    }
  };

  P.placePlayer = function (stationId) { var w = wpos(this.data.stations[stationId]); this.pp.x = w.x; this.pp.y = w.y; this.move = null; };
  P.stationPos = function (id) { return wpos(this.data.stations[id]); };

  /** Anima al jugador de la estación a a la b durante `dur` segundos. */
  P.walk = function (a, b, dur) { this.move = { a: wpos(this.data.stations[a]), b: wpos(this.data.stations[b]), t: 0, dur: dur }; };
  P.moving = function () { return !!this.move; };

  P.zoomBy = function (d) { this.cam.zoom = util.clamp(Math.round((this.cam.zoom + d) * 10) / 10, 0.4, 2); };

  /** Estación bajo el puntero (coordenadas de pantalla) o null. */
  P.pick = function (sx, sy) {
    var w = this.layer.convertCoords(sx, sy, 0, [0, 0]), best = null, bd = 22 / 1;
    this.data.stationList.forEach(function (st) {
      var p = wpos(st), d = Math.hypot(w[0] - p.x, w[1] - p.y);
      if (d < bd) { bd = d; best = st.id; }
    });
    return best;
  };

  P.pan = function (dxScreen, dyScreen) { this.cam.x -= dxScreen / this.cam.zoom; this.cam.y -= dyScreen / this.cam.zoom; this.cam.follow = false; };

  P.update = function (dt, run, ui, hoverId) {
    this.t += dt;
    if (this.move) {
      var m = this.move; m.t += dt; var k = util.clamp(m.t / m.dur, 0, 1);
      this.pp.x = util.lerp(m.a.x, m.b.x, k); this.pp.y = util.lerp(m.a.y, m.b.y, k) - Math.sin(k * Math.PI) * 6;
      if (k >= 1) { this.pp.y = m.b.y; this.move = null; }
    }
    // Jugador: 2 cuadros de "respiración"
    var pl = this.player; pl.setAnimationName(Math.floor(this.t * 3) % 2 ? 'a1' : 'a0'); pl.setScale(3);
    pl.setPosition(this.pp.x - 18, this.pp.y - 54);
    // Cámara: sigue al jugador dejando libre el lado del celular
    if (this.cam.follow) {
      var tx = this.pp.x + 190 / this.cam.zoom, ty = this.pp.y + 10;
      this.cam.x = util.lerp(this.cam.x, tx, Math.min(1, dt * 6)); this.cam.y = util.lerp(this.cam.y, ty, Math.min(1, dt * 6));
    }
    this.layer.setCameraX(this.cam.x); this.layer.setCameraY(this.cam.y); this.layer.setCameraZoom(this.cam.zoom);
    this._drawGround(); this._drawRoutes(run, hoverId); this._updateStations(run, ui, hoverId);
  };

  P._drawGround = function () {
    var g = this.ground; g.clear();
    g.setFillColor('14;12;28'); g.setFillOpacity(255); g.drawRectangle(-2000, -2000, COLS * TILE + OX + 2000, ROWS * TILE + OY + 2000);
    g.setFillColor('22;22;44'); g.drawRectangle(OX - TILE, OY - TILE, OX + (COLS - 1) * TILE, OY + (ROWS - 1) * TILE);
    g.setOutlineColor('34;34;62'); g.setOutlineOpacity(255);
    for (var x = 0; x < COLS; x++) g.drawLineV2(OX + (x - 0.5) * TILE, OY - TILE, OX + (x - 0.5) * TILE, OY + (ROWS - 1) * TILE, 2);
    for (var y = 0; y < ROWS; y++) g.drawLineV2(OX - TILE, OY + (y - 0.5) * TILE, OX + (COLS - 1) * TILE, OY + (y - 0.5) * TILE, 2);
  };

  P._drawRoutes = function (run, hoverId) {
    var r = this.routes, d = this.data; r.clear();
    d.connections.forEach(function (c) {
      var a = d.stations[c.a], b = d.stations[c.b], pa = wpos(a), pb = wpos(b);
      var blocked = run.blocked[c.a] || run.blocked[c.b], cost = U.Rules.edgeCost(run, c.a, c.b), slow = cost > c.cost + 2;
      var col = blocked ? '120;80;150' : slow ? '231;76;60' : util.hex(a.color), op = blocked ? 90 : 255;
      r.setOutlineColor('0;0;0'); r.setOutlineOpacity(110); r.drawLineV2(pa.x, pa.y + 4, pb.x, pb.y + 4, c.transfer ? 5 : 9);
      r.setOutlineColor(c.transfer ? '255;255;255' : col); r.setOutlineOpacity(c.transfer ? 150 : op);
      if (c.transfer) {   // transbordo: línea punteada
        var n = Math.max(2, Math.floor(Math.hypot(pb.x - pa.x, pb.y - pa.y) / 10));
        for (var i = 0; i < n; i += 2) r.drawLineV2(util.lerp(pa.x, pb.x, i / n), util.lerp(pa.y, pb.y, i / n), util.lerp(pa.x, pb.x, (i + 1) / n), util.lerp(pa.y, pb.y, (i + 1) / n), 4);
      } else r.drawLineV2(pa.x, pa.y, pb.x, pb.y, 6);
    });
    // Halos: estaciones alcanzables (pulso) y estación actual
    var pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    U.Graph.neighbors(run.graph, run.current).forEach(function (n) {
      if (run.blocked[n]) return; var p = wpos(d.stations[n]);
      r.setFillColor('255;255;255'); r.setFillOpacity(60 + 80 * pulse); r.drawCircle(p.x, p.y, 20 + 3 * pulse);
    });
    var cp = wpos(d.stations[run.current]); r.setFillColor('255;107;53'); r.setFillOpacity(70 + 50 * pulse); r.drawCircle(cp.x, cp.y, 26 + 3 * pulse);
    if (hoverId) { var hp = wpos(d.stations[hoverId]); r.setFillColor('255;255;255'); r.setFillOpacity(70); r.drawCircle(hp.x, hp.y, 22); }
    // Sombra del jugador
    r.setFillColor('0;0;0'); r.setFillOpacity(110); r.drawEllipse(this.pp.x, this.pp.y + 2, 26, 10);
  };

  P._updateStations = function (run, ui, hoverId) {
    var d = this.data, lv = run.level, showNames = this.cam.zoom >= 0.7;
    var vx0 = this.cam.x - 700 / this.cam.zoom, vx1 = this.cam.x + 700 / this.cam.zoom, vy0 = this.cam.y - 400 / this.cam.zoom, vy1 = this.cam.y + 400 / this.cam.zoom;
    d.stationList.forEach(function (st) {
      var s = this.sprites[st.id], p = wpos(st), blocked = run.blocked[st.id];
      var anim = st.id === lv.goal ? 'meta' : blocked ? 'bloqueada' : st.id === lv.start ? 'inicio' : st.shop ? 'tienda' : 'normal';
      if (s._umAnim !== anim) { s.setAnimationName(anim); s._umAnim = anim; }
      var tint = st.id === lv.goal ? '46;204;113' : blocked ? '155;89;182' : st.shop ? '90;170;255' : util.hex(st.color);
      if (s._umTint !== tint) { s.setColor(tint); s._umTint = tint; }
      var sc = ST_SCALE * (st.id === run.current ? 1.25 : st.id === hoverId ? 1.15 : 1); s.setScale(sc);
      s.setPosition(p.x - ICON * sc / 2, p.y - ICON * sc / 2);
      var vis = p.x > vx0 && p.x < vx1 && p.y > vy0 && p.y < vy1;
      if (showNames && vis) {
        ui.text('lbl:' + st.id, st.id, p.x, p.y + 20, { layer: '', align: 'center', size: 8, z: 80, color: blocked ? '155;89;182' : '235;235;250' });
        if (st.shop && !blocked && st.id !== lv.goal) ui.icon('shp:' + st.id, 'tienda', p.x + 14, p.y - 34, 1.5, { layer: '', z: 81 });
      }
    }, this);
  };

  U.MapView = MapView;
})();
