/* UrbanMex · fx — capa de efectos visuales: iluminación dinámica, sombras suaves, partículas sutiles (polvo, brillos, niebla),
 * gradación de color según la hora, profundidad de campo ligera (bruma + bokeh) y viñeta.
 * No cambia ningún personaje, objeto ni composición: solo añade luz y atmósfera encima del dibujo original.
 *
 * Cómo funciona: sprites suaves "fx_*" (luz radial, mota, niebla, viñeta, destello, sombra, haz, bruma) con modos de mezcla de PIXI
 * (0 normal, 1 aditivo, 2 multiplicar, 3 pantalla; verificado en spriteruntimeobject.ts: setBlendMode). Viven en dos sitios:
 *   · capa "FX" (sin cámara; entre el mapa y la interfaz): gradación, luz solar, bruma, niebla, polvo, bokeh y viñeta;
 *   · capa base ("", se mueve con el mapa): luces bajo estaciones y jugador, haz de la meta, destellos y sombra del jugador.
 * Objeto requerido: Fx (animaciones glow, soft, fog, vignette, spark, shadow, beam, haze_t, haze_b, solid). Capa requerida: "FX".
 * Calidad: U.session.fxQuality = 'high' (por defecto) | 'low' (menos partículas y luces) | 'off' (sin efectos). */
(function () {
  var U = gdjs.UrbanMex, util = U.util, clamp = util.clamp;
  if (U.FX) return;

  var W = 1280, H = 720, LAYER = 'FX';
  var BLEND = { normal: 0, add: 1, multiply: 2, screen: 3 };
  var SIZE = { glow: [128, 128], soft: [32, 32], fog: [256, 128], vignette: [320, 180], spark: [32, 32], shadow: [64, 32], beam: [32, 128],
               haze_t: [320, 64], haze_b: [320, 64], solid: [4, 4] };   // = tools/make_art.py (sprites fx_*)

  // ---- utilidades de color -------------------------------------------------------------------------------------------
  function str(c) { return Math.round(clamp(c[0], 0, 255)) + ';' + Math.round(clamp(c[1], 0, 255)) + ';' + Math.round(clamp(c[2], 0, 255)); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function hexArr(h) { var n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function modpos(a, m) { return ((a % m) + m) % m; }
  function quality() { var q = U.session.fxQuality; return q === 'low' || q === 'off' ? q : 'high'; }

  // ---- escenario: pool de sprites "Fx" (se reutilizan; los que no se usan en el fotograma se ocultan) ------------------------
  function Stage(scene) { this.scene = scene; this.pool = {}; this.used = {}; this.count = 0; }
  Stage.prototype.begin = function () { this.used = {}; };
  Stage.prototype.end = function () { for (var id in this.pool) if (!this.used[id]) this.pool[id].hide(true); };
  /** Sprite centrado en (cx, cy) de w x h px. o: {layer ('FX' por defecto, '' = mapa), z, opacity 0..255, color 'r;g;b', blend, angle} */
  Stage.prototype.spr = function (key, anim, cx, cy, w, h, o) {
    o = o || {}; var layer = o.layer === undefined ? LAYER : o.layer, id = layer + ':' + key, s = this.pool[id];
    if (!s) { s = this.pool[id] = this.scene.createObject('Fx'); s.setLayer(layer); this.count++; }
    this.used[id] = true; s.hide(false);
    if (s._umAnim !== anim) { s.setAnimationName(anim); s._umAnim = anim; }
    var sz = SIZE[anim]; s.setScaleX(w / sz[0]); s.setScaleY(h / sz[1]); s.setPosition(cx - w / 2, cy - h / 2);
    s.setZOrder(o.z || 0); s.setOpacity(Math.round(clamp(o.opacity === undefined ? 255 : o.opacity, 0, 255)));
    var col = o.color || '255;255;255'; if (s._umColor !== col) { s.setColor(col); s._umColor = col; }
    var bl = o.blend || 0; if (s._umBlend !== bl) { s.setBlendMode(bl); s._umBlend = bl; }
    var an = o.angle || 0; if (s._umAngle !== an) { s.setAngle(an); s._umAngle = an; }
    return s;
  };

  // ---- atmósfera: polvo, bokeh y niebla (posiciones = función pura del tiempo → reproducible, sin acumular error) --------------
  var ATMOS = {
    level:   { seed: 11, dust: 26, bokeh: 6, fog: 5, bands: [[40, 210], [400, 650]] },
    menu:    { seed: 23, dust: 24, bokeh: 5, fog: 4, bands: [[470, 700]] },
    ambient: { seed: 37, dust: 14, bokeh: 4, fog: 3, bands: [[0, 720]] }
  };
  function Atmos(cfg, q) {
    var rnd = util.seeded(cfg.seed), k = q === 'low' ? 0.4 : 1, i;
    this.dust = []; this.bokeh = []; this.fog = [];
    for (i = 0; i < Math.round(cfg.dust * k); i++) this.dust.push({ x: rnd() * W, y: rnd() * H, vx: util.range(rnd, -4, 9), vy: util.range(rnd, -5, 2), size: util.range(rnd, 4, 9),
      ph: rnd() * 6.28, depth: util.range(rnd, 0.3, 1), op: util.range(rnd, 55, 125) });
    for (i = 0; i < (q === 'low' ? 0 : cfg.bokeh); i++) this.bokeh.push({ x: rnd() * W, y: rnd() * H, vx: util.range(rnd, 2, 7), vy: util.range(rnd, -3, 3), size: util.range(rnd, 40, 96),
      ph: rnd() * 6.28, depth: util.range(rnd, 1.2, 1.8), op: util.range(rnd, 10, 24) });
    for (i = 0; i < Math.max(q === 'low' ? 2 : 0, Math.round(cfg.fog * k)); i++) {
      var band = cfg.bands[i % cfg.bands.length];
      this.fog.push({ x: rnd() * W, y: util.range(rnd, band[0], band[1]), w: util.range(rnd, 520, 760), h: util.range(rnd, 170, 250), vx: util.range(rnd, 4, 12),
        depth: util.range(rnd, 0.1, 0.25), op: util.range(rnd, 24, 40) });
    }
  }
  /** Dibuja las partículas. tone: {dust, fog 'r;g;b', k intensidad}. cam: cámara del mapa (para el paralaje) o null. */
  Atmos.prototype.draw = function (st, t, tone, cam) {
    var ox = 0, oy = 0, k = tone.k === undefined ? 1 : tone.k;
    if (cam) { if (!this.cam0) this.cam0 = { x: cam.x, y: cam.y }; ox = (cam.x - this.cam0.x) * cam.zoom; oy = (cam.y - this.cam0.y) * cam.zoom; }
    this.fog.forEach(function (f, i) {
      var cx = modpos(f.x + f.vx * t - ox * f.depth, W + f.w) - f.w / 2, cy = f.y + Math.sin(t * 0.07 + i) * 8 - oy * f.depth;
      st.spr('fog' + i, 'fog', cx, cy, f.w, f.h, { z: 10 + i, opacity: f.op * k * (0.85 + 0.15 * Math.sin(t * 0.21 + i * 2)), color: tone.fog });
    });
    this.dust.forEach(function (d, i) {
      var cx = modpos(d.x + d.vx * t - ox * d.depth * 0.3 + 40, W + 80) - 40, cy = modpos(d.y + d.vy * t + Math.sin(t * 0.5 + d.ph) * 10 - oy * d.depth * 0.3 + 40, H + 80) - 40;
      var tw = 0.55 + 0.45 * Math.sin(t * 1.3 + d.ph);
      st.spr('dust' + i, 'soft', cx, cy, d.size, d.size, { z: 20, opacity: d.op * tw * k, color: tone.dust, blend: BLEND.add });
    });
    this.bokeh.forEach(function (b, i) {
      var cx = modpos(b.x + b.vx * t - ox * b.depth * 0.3 + 100, W + 200) - 100, cy = modpos(b.y + b.vy * t - oy * b.depth * 0.3 + 100, H + 200) - 100;
      st.spr('bokeh' + i, 'soft', cx, cy, b.size, b.size, { z: 25, opacity: b.op * (0.7 + 0.3 * Math.sin(t * 0.6 + b.ph)) * k, color: tone.dust, blend: BLEND.add });
    });
  };

  /** Viñeta + bruma superior e inferior (la "profundidad de campo" ligera): lo lejano se vela, los bordes cercanos se oscurecen. */
  function frame(st, vig, hazeTop, hazeTopA, hazeBot, hazeBotA) {
    st.spr('haze_t', 'haze_t', W / 2, 90, W, 180, { z: 3, opacity: hazeTopA, color: str(hazeTop) });
    st.spr('haze_b', 'haze_b', W / 2, H - 60, W, 120, { z: 4, opacity: hazeBotA, color: str(hazeBot) });
    st.spr('vig', 'vignette', W / 2, H / 2, W, H, { z: 40, opacity: vig });
  }

  // ====================================================================================================================
  // NIVEL: iluminación dinámica sobre el mapa isométrico
  // ====================================================================================================================
  // Gradación según la hora del nivel (0 = 7:00 AM, 1 = 8:00 PM): luz de la mañana → mediodía → hora dorada → anochecer.
  var TOD = [
    { t: 0.00, grade: [255, 246, 232], sun: [255, 208, 142], sunA: 74, haze: [170, 186, 224], hazeA: 62, vig: 150 },
    { t: 0.40, grade: [255, 255, 255], sun: [255, 238, 196], sunA: 44, haze: [160, 180, 222], hazeA: 52, vig: 132 },
    { t: 0.75, grade: [255, 228, 194], sun: [255, 152, 80], sunA: 84, haze: [236, 164, 124], hazeA: 66, vig: 156 },
    { t: 1.00, grade: [200, 184, 238], sun: [255, 106, 86], sunA: 58, haze: [112, 98, 172], hazeA: 90, vig: 190 }
  ];
  function lighting(tod) {
    var i = 0; while (i < TOD.length - 2 && tod > TOD[i + 1].t) i++;
    var a = TOD[i], b = TOD[i + 1], k = clamp((tod - a.t) / (b.t - a.t), 0, 1);
    return { grade: mix(a.grade, b.grade, k), sun: mix(a.sun, b.sun, k), sunA: util.lerp(a.sunA, b.sunA, k), haze: mix(a.haze, b.haze, k),
             hazeA: util.lerp(a.hazeA, b.hazeA, k), vig: util.lerp(a.vig, b.vig, k) };
  }

  function LevelFX(scene, um) {
    this.um = um; this.q = quality(); this.t = 0; this.stage = new Stage(scene); this.atmos = new Atmos(ATMOS.level, this.q); this.sparks = [];
    um.map.softShadow = true;                                    // la sombra dura del jugador cede su lugar a la sombra suave de este módulo
    var rnd = util.seeded(77), run = um.run, lv = run.level;
    um.data.stationList.forEach(function (st) {                  // brillos en la meta, el inicio y las tiendas
      var n = st.id === lv.goal ? 3 : st.shop || st.id === lv.start ? 2 : 0;
      for (var i = 0; i < n; i++) this.sparks.push({ id: st.id, ox: util.range(rnd, -16, 16), oy: -util.range(rnd, 14, 40), ph: rnd() * 6.28, sp: util.range(rnd, 1.4, 2.6), size: util.range(rnd, 14, 24), goal: st.id === lv.goal });
    }, this);
  }
  LevelFX.prototype.update = function (dt, hoverId, selId) {
    var um = this.um, run = um.run, map = um.map, d = um.data, cfg = d.config, lv = run.level, st = this.stage, cam = map.cam;
    this.t += dt; var t = this.t, pulse = 0.5 + 0.5 * Math.sin(t * 6);
    st.begin();
    var tod = clamp((run.minute - cfg.dayStartMinute) / (cfg.dayEndMinute - cfg.dayStartMinute), 0, 1), L = lighting(tod);

    // --- pantalla: gradación, luz solar desde arriba a la izquierda (la misma dirección con la que se pintaron los sprites), bruma y viñeta
    st.spr('grade', 'solid', W / 2, H / 2, W, H, { z: 1, color: str(L.grade), blend: BLEND.multiply });
    st.spr('sun', 'glow', 150, 30, 1180, 860, { z: 2, color: str(L.sun), opacity: L.sunA * (1 + 0.06 * Math.sin(t * 0.6)), blend: BLEND.add });
    frame(st, L.vig, L.haze, L.hazeA, [10, 8, 24], 110);
    this.atmos.draw(st, t, { dust: str(mix([255, 255, 255], L.sun, 0.55)), fog: str(mix([206, 216, 240], L.haze, 0.4)), k: 1 }, cam);

    // --- mapa: luz bajo cada estación (color de su línea), más fuerte en las que importan
    var near = {}, lit = this.q === 'high', hl = map.highlight,   // calidad baja: solo las estaciones que importan
 onScreen = function (p) { var sx = (p.x - cam.x) * cam.zoom + 640, sy = (p.y - cam.y) * cam.zoom + 360; return sx > -90 && sx < W + 90 && sy > -90 && sy < H + 90; };
    U.Graph.neighbors(run.graph, run.current).forEach(function (n) { near[n] = true; });
    d.stationList.forEach(function (s) {
      var p = map.stationPos(s.id), key = s.id === run.current || s.id === lv.goal || s.id === lv.start || s.id === hoverId || s.id === selId, blocked = run.blocked[s.id];
      if (!key && !near[s.id] && !lit) return;                    // calidad baja: solo las estaciones importantes
      if (!onScreen(p)) return;
      var col = s.id === lv.goal ? '46;204;113' : blocked ? '155;89;182' : s.shop ? '90;170;255' : util.hex(s.color);
      var size = key ? 104 : near[s.id] ? 84 : 66, op = key ? 92 : near[s.id] ? 64 : 40;
      if (s.id === hoverId || s.id === selId) { size = 118; op = 118 + 30 * pulse; }
      if (s.id === run.current) { size = 120; col = '255;150;80'; op = 104 + 24 * pulse; }
      if (s.id === lv.goal) op = 110 + 40 * pulse;
      if (hl && s.line !== hl && !key) op *= 0.3;                 // línea elegida en el celular: las demás se apagan
      if (blocked) op *= 0.7;
      st.spr('sl:' + s.id, 'glow', p.x, p.y, size, size * 0.62, { layer: '', z: 55, color: col, opacity: op, blend: BLEND.add });
    });

    // --- jugador: luz cálida que lo acompaña y sombra de contacto suave
    var pp = map.pp, walking = map.moving();
    st.spr('pl:light', 'glow', pp.x, pp.y - 14, 150 + 10 * pulse, 110, { layer: '', z: 68, color: '255;190;120', opacity: 70 + 16 * pulse, blend: BLEND.add });
    st.spr('pl:shadow', 'shadow', pp.x, pp.y + 4, walking ? 40 : 46, walking ? 14 : 16, { layer: '', z: 69, opacity: walking ? 120 : 150 });

    // --- meta: haz de luz vertical que respira
    var g = map.stationPos(lv.goal);
    if (onScreen(g)) st.spr('goal:beam', 'beam', g.x, g.y - 6 - 55, 30 + 4 * pulse, 110, { layer: '', z: 62, color: '120;255;170', opacity: 120 + 60 * pulse, blend: BLEND.add });

    // --- destellos: meta, inicio y tiendas
    this.sparks.forEach(function (s, i) {
      var p = map.stationPos(s.id), a = Math.max(0, Math.sin(t * s.sp + s.ph)); a *= a;
      if (a < 0.02 || run.blocked[s.id] || !onScreen(p)) return;
      var sz = s.size * (0.6 + 0.5 * a);
      st.spr('sp' + i, 'spark', p.x + s.ox, p.y + s.oy, sz, sz, { layer: '', z: 85, color: s.goal ? '190;255;215' : '255;246;220', opacity: 235 * a, blend: BLEND.add, angle: 0 });
    });
    st.end();
  };

  // ====================================================================================================================
  // MENÚ: luz del tren, resplandor de la ciudad, estrellas que centellean, niebla baja
  // ====================================================================================================================
  function MenuFX(scene) { this.q = quality(); this.t = 0; this.stage = new Stage(scene); this.atmos = new Atmos(ATMOS.menu, this.q); }
  MenuFX.prototype.update = function (dt, m) {
    var st = this.stage, t = (this.t += dt), pulse = 0.5 + 0.5 * Math.sin(t * 2);
    st.begin();
    st.spr('sky', 'haze_t', W / 2, 150, W, 300, { z: 1, color: '120;86;190', opacity: 70, blend: BLEND.add });
    st.spr('city', 'glow', W / 2, 700, 1600, 340, { z: 2, color: '255;140;72', opacity: 62 + 10 * pulse, blend: BLEND.add });   // resplandor de la ciudad que sube desde abajo
    frame(st, 40, [150, 130, 210], 40, [8, 6, 18], 34);        // en el menú la bruma inferior es mínima: no debe apagar el tren ni la base de los edificios
    this.atmos.draw(st, t, { dust: '255;226;190', fog: '176;178;214', k: 0.4 }, null);
    var tx = m.train.getX(), ty = 604;                            // el tren (96x24 px a escala 3) alumbra el riel, la lata y el piso
    for (var c = 0; c < 3; c++) for (var w = 0; w < 3; w++) {
      var wx = tx + (c * 32 + [3, 12, 21][w] + 3.5) * 3;
      st.spr('tw' + c + w, 'glow', wx, ty + 24, 40, 28, { z: 30, color: '255;214;130', opacity: 40, blend: BLEND.add });
    }
    st.spr('th', 'glow', tx + 288 + 70, ty + 62, 280, 76, { z: 31, color: '255;236;170', opacity: 56, blend: BLEND.add });          // faro delantero sobre el riel
    st.spr('tg', 'glow', tx + 144, 694, 380, 44, { z: 32, color: '255;150;80', opacity: 40, blend: BLEND.add });                    // luz sobre el piso
    st.spr('train:shadow', 'shadow', tx + 144, 684, 300, 26, { z: 33, opacity: 90 });
    m.stars.forEach(function (s, i) {                            // los 8 primeros luceros centellean con destello en cruz
      if (i >= 8) return; var a = Math.max(0, Math.sin(t * (1.1 + i * 0.13) + s[2])); a *= a;
      if (a > 0.02) st.spr('star' + i, 'spark', s[0] + 2, s[1] + 2, 12 + 14 * a, 12 + 14 * a, { z: 34, color: '255;248;225', opacity: 215 * a, blend: BLEND.add });
    });
    if (m.view === 'main') st.spr('logo', 'glow', 640, 118, 220 + 14 * pulse, 190, { z: 35, color: '255;120;60', opacity: 56 + 26 * pulse, blend: BLEND.add });   // aura del logo (el icono se dibuja en la capa UI, encima)
    st.end();
  };

  // ====================================================================================================================
  // Tutorial / Resultado: viñeta, bruma, polvo y niebla suaves (tone: 'neutral' | 'win' | 'lose')
  // ====================================================================================================================
  function AmbientFX(scene, tone) { this.q = quality(); this.t = 0; this.tone = tone || 'neutral'; this.stage = new Stage(scene); this.atmos = new Atmos(ATMOS.ambient, this.q); }
  AmbientFX.prototype.update = function (dt, tone) {
    var st = this.stage, t = (this.t += dt), tn = tone || this.tone, pulse = 0.5 + 0.5 * Math.sin(t * 1.2);
    var glow = tn === 'win' ? '70;210;120' : tn === 'lose' ? '220;70;60' : '255;130;70';
    st.begin();
    st.spr('top', 'glow', W / 2, 40, 1300, 420, { z: 2, color: glow, opacity: (tn === 'neutral' ? 36 : 54) + 10 * pulse, blend: BLEND.add });
    frame(st, 150, [150, 130, 210], 44, [8, 6, 18], 90);
    this.atmos.draw(st, t, { dust: '255;232;200', fog: '176;178;214', k: 0.9 }, null);
    st.end();
  };

  /** Efectos nulos (calidad "off"): mismos métodos, no hacen nada y no crean ningún objeto. */
  var NONE = { update: function () {}, stage: { count: 0 } };

  U.FX = {
    BLEND: BLEND, lighting: lighting, quality: quality,
    level: function (scene, um) { return quality() === 'off' ? ((um.map.softShadow = false), NONE) : new LevelFX(scene, um); },
    menu: function (scene) { return quality() === 'off' ? NONE : new MenuFX(scene); },
    ambient: function (scene, tone) { return quality() === 'off' ? NONE : new AmbientFX(scene, tone); }
  };
})();
