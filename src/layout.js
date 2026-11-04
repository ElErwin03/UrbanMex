/* UrbanMex · layout — cómo se acomoda el mapa sobre la cuadrícula (funciones puras, sin motor; se prueban solas).
 *
 *  · K: separación entre estaciones. Las coordenadas de estaciones.json (la cuadrícula lógica) NO cambian; el mapa las multiplica por K
 *    para que las estaciones y sus nombres respiren (en las líneas 2 y 3 las estaciones estaban a una sola casilla y se tocaban).
 *  · Rutas secundarias (combis y transbordos): ya no son rectas diagonales que atraviesan todo el mapa. Siguen la cuadrícula de calles
 *    (tramos rectos en los ejes, con codos), y para cada una se elige entre muchos trazados candidatos el que menos se encima con las
 *    líneas del Metro, menos las cruza, menos pasa pegado a otras estaciones y menos se mezcla con otras rutas secundarias. */
(function () {
  var U = gdjs.UrbanMex;
  if (U.Layout) return;

  var K = 1.3;
  var W = { len: 0.6, bend: 0.8, overlap: 12, cross: 1.5, station: 10, secOverlap: 8, secCross: 1 };   // pesos del puntaje (menor = mejor)
  var LANE = 0.85 * K, NEAR = 0.55 * K;                       // separación mínima entre tramos paralelos y a una estación ajena

  function pos(st) { return { gx: st.x * K, gy: st.y * K }; }

  /** Casillas de la isla de la ciudad: la red + un margen de 2 casillas por lado. */
  function bounds(data) {
    var b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    data.stationList.forEach(function (s) { var p = pos(s); b.x0 = Math.min(b.x0, p.gx); b.x1 = Math.max(b.x1, p.gx); b.y0 = Math.min(b.y0, p.gy); b.y1 = Math.max(b.y1, p.gy); });
    return { x0: Math.floor(b.x0) - 2, x1: Math.ceil(b.x1) + 2, y0: Math.floor(b.y0) - 2, y1: Math.ceil(b.y1) + 2 };
  }

  function dedupe(pts) { return pts.filter(function (p, i) { return !i || Math.abs(p.gx - pts[i - 1].gx) > 1e-6 || Math.abs(p.gy - pts[i - 1].gy) > 1e-6; }); }
  function segs(pts) { var s = []; for (var i = 1; i < pts.length; i++) s.push([pts[i - 1], pts[i]]); return s; }
  function length(pts) { return segs(pts).reduce(function (n, s) { return n + Math.hypot(s[1].gx - s[0].gx, s[1].gy - s[0].gy); }, 0); }

  function distSeg(px, py, a, b) {
    var dx = b.gx - a.gx, dy = b.gy - a.gy, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - a.gx) * dx + (py - a.gy) * dy) / l)) : 0;
    return Math.hypot(px - (a.gx + t * dx), py - (a.gy + t * dy));
  }
  /** Cruce propio de dos segmentos (los extremos que se tocan no cuentan). */
  function crosses(p, q, r, s) {
    var o = function (a, b, c) { return (b.gx - a.gx) * (c.gy - a.gy) - (b.gy - a.gy) * (c.gx - a.gx); }, e = 1e-9;
    var d1 = o(p, q, r), d2 = o(p, q, s), d3 = o(r, s, p), d4 = o(r, s, q);
    return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
  }
  /** Longitud en la que dos segmentos van encimados (paralelos en un eje y a menos de LANE), recortando el primer/último tramo cerca de los extremos. */
  function overlap(p, q, r, s) {
    var hp = Math.abs(p.gy - q.gy) < 1e-9, vp = Math.abs(p.gx - q.gx) < 1e-9, hr = Math.abs(r.gy - s.gy) < 1e-9, vr = Math.abs(r.gx - s.gx) < 1e-9;
    if (hp && hr && Math.abs(p.gy - r.gy) < LANE) return Math.max(0, Math.min(Math.max(p.gx, q.gx), Math.max(r.gx, s.gx)) - Math.max(Math.min(p.gx, q.gx), Math.min(r.gx, s.gx)));
    if (vp && vr && Math.abs(p.gx - r.gx) < LANE) return Math.max(0, Math.min(Math.max(p.gy, q.gy), Math.max(r.gy, s.gy)) - Math.max(Math.min(p.gy, q.gy), Math.min(r.gy, s.gy)));
    return 0;
  }

  /** Trazados candidatos entre A y B: línea recta, dos codos (L), y "Z"/"U" con el tramo central en distintos carriles. */
  function candidates(A, B) {
    var out = [], push = function (pts) { pts = dedupe(pts); if (pts.length >= 2) out.push(pts); };
    var P = function (x, y) { return { gx: x, gy: y }; };
    if (Math.abs(A.gx - B.gx) < 1e-9 || Math.abs(A.gy - B.gy) < 1e-9) push([A, B]);     // recta solo si ya va por una calle; nunca en diagonal
    push([A, P(B.gx, A.gy), B]); push([A, P(A.gx, B.gy), B]);
    var fr = [0.25, 0.5, 0.75], off = [-1.8, -1.2, -0.7, 0.7, 1.2, 1.8];
    var xs = fr.map(function (f) { return A.gx + (B.gx - A.gx) * f; }), ys = fr.map(function (f) { return A.gy + (B.gy - A.gy) * f; });
    off.forEach(function (o) { xs.push(A.gx + o * K, B.gx + o * K); ys.push(A.gy + o * K, B.gy + o * K); });
    xs.forEach(function (x) { push([A, P(x, A.gy), P(x, B.gy), B]); });
    ys.forEach(function (y) { push([A, P(A.gx, y), P(B.gx, y), B]); });
    return out;
  }

  /** Puntaje de un trazado frente a las líneas del Metro (mains), las estaciones y las rutas secundarias ya acomodadas (others). */
  function score(pts, a, b, mains, others, stations) {
    var sc = W.len * length(pts) + W.bend * (pts.length - 2), mine = segs(pts), rim = 0.5 * K;
    mine.forEach(function (m) {
      mains.forEach(function (s) {
        sc += W.overlap * overlap(m[0], m[1], s[0], s[1]);
        if (crosses(m[0], m[1], s[0], s[1])) sc += W.cross;
      });
      others.forEach(function (o) {
        o.forEach(function (s) { sc += W.secOverlap * overlap(m[0], m[1], s[0], s[1]); if (crosses(m[0], m[1], s[0], s[1])) sc += W.secCross; });
      });
    });
    stations.forEach(function (s) {
      if (s === a || s === b) return;
      var p = pos(s), d = Math.min.apply(null, mine.map(function (m) { return distSeg(p.gx, p.gy, m[0], m[1]); }));
      if (d < NEAR) sc += W.station * (1 - d / NEAR + 0.5);
    });
    return sc;
  }

  /** Trazados de todas las rutas secundarias (combis y transbordos): [{ conn, pts:[{gx,gy}] }]. Determinista. */
  function secondary(data) {
    var mains = [], sec = data.connections.filter(function (c) { return c.combi || c.transfer; });
    data.connections.forEach(function (c) {
      if (c.combi || c.transfer) return;
      var pa = pos(data.stations[c.a]), pb = pos(data.stations[c.b]); mains.push([pa, pb]);
    });
    sec.sort(function (u, v) { return (v.combi ? 1 : 0) - (u.combi ? 1 : 0); });     // primero las combis (más largas, necesitan más libertad)
    var placed = [], res = [];
    sec.forEach(function (c) {
      var a = data.stations[c.a], b = data.stations[c.b], A = { gx: pos(a).gx, gy: pos(a).gy }, B = { gx: pos(b).gx, gy: pos(b).gy };
      var best = null, bs = 1e18;
      candidates(A, B).forEach(function (pts) { var s = score(pts, a, b, mains, placed, data.stationList); if (s < bs - 1e-9) { bs = s; best = pts; } });
      placed.push(segs(best)); res.push({ conn: c, pts: best, score: bs });
    });
    var order = {}; data.connections.forEach(function (c, i) { order[c.a + '|' + c.b] = i; });
    return res.sort(function (u, v) { return order[u.conn.a + '|' + u.conn.b] - order[v.conn.a + '|' + v.conn.b]; });
  }

  /** Trazado recto de una vía del Metro (se conserva tal cual: las líneas principales siguen siendo rectas). */
  function straight(data, c) { return [pos(data.stations[c.a]), pos(data.stations[c.b])]; }

  /** Métricas de comparación: cuánto se encima y cuánto cruza una ruta con las líneas del Metro (para pruebas y el README). */
  function stats(data, pts, conn) {
    var mains = [], me = segs(pts), ov = 0, cr = 0;
    data.connections.forEach(function (c) { if (!c.combi && !c.transfer) mains.push([pos(data.stations[c.a]), pos(data.stations[c.b])]); });
    me.forEach(function (m) { mains.forEach(function (s) { ov += overlap(m[0], m[1], s[0], s[1]); if (crosses(m[0], m[1], s[0], s[1])) cr++; }); });
    return { overlap: ov / K, crossings: cr, length: length(pts) / K };
  }

  U.Layout = { K: K, pos: pos, bounds: bounds, secondary: secondary, straight: straight, stats: stats, length: length, segs: segs, distSeg: distSeg };
})();
