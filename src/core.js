/* UrbanMex · core — espacio de nombres, sesión y utilidades.
 * Todo el juego cuelga de gdjs.UrbanMex. Este archivo no depende del motor: se puede probar en Node. */
(function () {
  var root = typeof globalThis !== 'undefined' ? globalThis : window;
  root.gdjs = root.gdjs || {};
  var U = (gdjs.UrbanMex = gdjs.UrbanMex || {});
  if (U.util) return; // ya cargado (los eventos externos se ejecutan cada fotograma)

  U.VERSION = '2.0.0';
  // Estado que sobrevive al cambio de escena (menú → nivel → resultado → nivel...)
  U.session = { levelIndex: 0, lastResult: null, completed: [], best: {}, inf: { best: 0, stars: 0 }, infinite: null, ach: {}, stats: null, dblTravel: true, loaded: false,
    vol: { music: { level: 7, mute: false }, sfx: { level: 7, mute: false }, alert: { level: 7, mute: false } } };   // completed: índices de niveles ganados; best: mejor marca por nivel {estrellas, dinero}; dblTravel y vol (volumen 0-10 y silencio de música / sonidos / peligro): ajustes, se guardan

  /** Progreso guardado (niveles completados y ajustes). Usa localStorage —lo mismo que las acciones de almacenamiento de GDevelop—,
   *  así que sobrevive entre partidas en el navegador y en las exportaciones de escritorio; sin almacenamiento solo dura la sesión. */
  U.Save = {
    KEY: 'UrbanMex_save_v1',
    _store: function () {
      try { var w = typeof window !== 'undefined' ? window : root; return w.localStorage || root.localStorage || null; } catch (e) { return null; }
    },
    /** Lee el guardado una sola vez por ejecución del juego. */
    load: function () {
      if (U.session.loaded) return; U.session.loaded = true;
      var d = null; try { var st = this._store(), raw = st && st.getItem(this.KEY); d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
      if (!d || d.v !== 1) return;
      U.session.completed = (d.completed || []).filter(function (i) { return typeof i === 'number' && i >= 0 && i % 1 === 0; });
      var best = {}; if (d.best && typeof d.best === 'object') Object.keys(d.best).forEach(function (k) {   // mejores marcas (se validan una a una)
        var v = d.best[k], i = +k;
        if (i >= 0 && i % 1 === 0 && v && v.stars >= 1 && v.stars <= 3 && v.stars % 1 === 0 && typeof v.money === 'number' && v.money >= 0 && isFinite(v.money)) best[i] = { stars: v.stars, money: Math.round(v.money) };
      });
      U.session.best = best;
      if (d.inf && typeof d.inf === 'object') {                                                      // mejor racha del modo infinito (se valida)
        var ib = d.inf.best, is = d.inf.stars;
        U.session.inf = { best: typeof ib === 'number' && ib >= 0 && ib % 1 === 0 && ib < 1e6 ? ib : 0, stars: typeof is === 'number' && is >= 0 && is % 1 === 0 && is < 1e7 ? is : 0 };
      }
      if (d.ach && typeof d.ach === 'object' && U.Achievements) {                                    // logros desbloqueados (solo ids conocidos) y estadísticas (enteros no negativos)
        var ach = {}; Object.keys(d.ach).forEach(function (k) { if (d.ach[k] === true && U.Achievements.byId(k)) ach[k] = true; });
        U.session.ach = ach;
      }
      if (d.stats && typeof d.stats === 'object' && U.Achievements) {
        var stt = U.Achievements.zero(); U.Achievements.STAT_KEYS.forEach(function (k) { var v = d.stats[k]; if (typeof v === 'number' && v >= 0 && v % 1 === 0 && v < 1e9) stt[k] = v; });
        U.session.stats = stt;
      }
      if (d.seenTutorial) U.session.seenTutorial = true;
      if (typeof d.dblTravel === 'boolean') U.session.dblTravel = d.dblTravel;
      if (d.fx === 'high' || d.fx === 'low' || d.fx === 'off') U.session.fxQuality = d.fx;          // accesibilidad (se validan: un guardado viejo o dañado no rompe nada)
      if (typeof d.calm === 'boolean') U.session.calm = d.calm;
      if (d.ui === 'auto' || d.ui === 'on' || d.ui === 'off') U.session.uiMode = d.ui;               // tamaño de la interfaz (mobile.js)
      if (typeof d.bg === 'boolean') U.session.bgAudio = d.bg;                                      // seguir sonando al salir de la ventana
      var vol = d.vol && typeof d.vol === 'object' ? d.vol : null;                                  // volúmenes por módulo (se validan: un guardado viejo o dañado no rompe nada)
      ['music', 'sfx', 'alert'].forEach(function (g) {
        var v = vol && vol[g], t = U.session.vol[g];
        if (v && typeof v.level === 'number' && v.level >= 0 && v.level <= 10 && v.level % 1 === 0) t.level = v.level;
        if (v && typeof v.mute === 'boolean') t.mute = v.mute;
        else if (!vol && d.audio === false) t.mute = true;                                           // guardado de la versión anterior (un solo interruptor): apagado = todo en silencio
      });
    },
    persist: function () {
      try {
        var st = this._store(); if (!st) return;
        st.setItem(this.KEY, JSON.stringify({ v: 1, completed: U.session.completed.slice().sort(function (a, b) { return a - b; }),
                                               best: U.session.best || {}, inf: U.session.inf || { best: 0, stars: 0 }, ach: U.session.ach || {}, stats: U.session.stats || {}, seenTutorial: !!U.session.seenTutorial, dblTravel: U.session.dblTravel !== false, vol: U.session.vol,
                                               fx: U.session.fxQuality === 'low' || U.session.fxQuality === 'off' ? U.session.fxQuality : 'high', calm: U.session.calm === true, ui: U.session.uiMode === 'on' || U.session.uiMode === 'off' ? U.session.uiMode : 'auto', bg: U.session.bgAudio === true }));
      } catch (e) { /* sin almacenamiento: el progreso dura solo la sesión */ }
    },
    isCompleted: function (idx) { return U.session.completed.indexOf(idx) >= 0; },
    markCompleted: function (idx) { if (!this.isCompleted(idx)) { U.session.completed.push(idx); this.persist(); } },
    /** Guarda la racha del modo infinito si es la mejor (más rondas; a igualdad, más estrellas). → { isNew, prev } */
    recordStreak: function (rounds, stars) {
      var prev = U.session.inf || { best: 0, stars: 0 }, isNew = rounds > prev.best || (rounds === prev.best && rounds > 0 && stars > prev.stars);
      if (isNew) { U.session.inf = { best: rounds, stars: stars }; this.persist(); }
      return { isNew: isNew, prev: { best: prev.best, stars: prev.stars } };
    },
    /** Guarda la mejor marca del nivel (más estrellas; a igual de estrellas, más dinero). → { isNew, prev } (prev: la marca anterior o null). */
    record: function (idx, stars, money) {
      var best = U.session.best = U.session.best || {}, prev = best[idx] || null;
      var isNew = !prev || stars > prev.stars || (stars === prev.stars && money > prev.money);
      if (isNew) { best[idx] = { stars: stars, money: Math.round(money) }; this.persist(); }
      return { isNew: isNew, prev: prev };
    },
    bestOf: function (idx) { return (U.session.best || {})[idx] || null; },
    /** Estrellas conseguidas en los primeros `total` niveles (su mejor marca de cada uno). */
    WEEK: 5,                                                    // niveles por semana (fila del selector y fin de semana en el resultado)
    /** Estrellas ganadas en los niveles de una semana (0 = la primera). */
    weekStars: function (week) { var n = 0; for (var i = week * this.WEEK; i < (week + 1) * this.WEEK; i++) { var b = this.bestOf(i); if (b) n += b.stars; } return n; },
    totalStars: function (total) {
      var n = 0; for (var i = 0; i < total; i++) { var b = this.bestOf(i); if (b) n += b.stars; } return n;
    },
    /** Nivel al que lleva JUGAR: el primero que aún no has completado (o el último si ya completaste todos). */
    nextLevel: function (total) {
      for (var i = 0; i < total; i++) if (!this.isCompleted(i)) return i;
      return Math.max(0, total - 1);
    },
    reset: function () { U.session.completed = []; U.session.best = {}; U.session.inf = { best: 0, stars: 0 }; U.session.infinite = null; U.session.ach = {}; U.session.stats = null; this.persist(); }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  U.util = {
    clamp: clamp,
    lerp: function (a, b, t) { return a + (b - a) * t; },
    pad2: pad2,
    /** "r;g;b" — formato de color que aceptan los objetos de GDevelop. */
    rgb: function (r, g, b) { return r + ';' + g + ';' + b; },
    /** "#rrggbb" → "r;g;b" */
    hex: function (h) {
      var n = parseInt(h.replace('#', ''), 16);
      return ((n >> 16) & 255) + ';' + ((n >> 8) & 255) + ';' + (n & 255);
    },
    /** Minutos desde medianoche → "7:05 AM" */
    clock: function (min) {
      var h = Math.floor(min / 60), m = min % 60, per = h >= 12 ? 'PM' : 'AM';
      var h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return h12 + ':' + pad2(m) + ' ' + per;
    },
    /** Minutos → "1h 32m" */
    duration: function (min) { return Math.floor(min / 60) + 'h ' + pad2(min % 60) + 'm'; },
    /** Generador pseudoaleatorio con semilla (mulberry32), para pruebas reproducibles. */
    seeded: function (seed) {
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    range: function (rnd, lo, hi) { return lo + rnd() * (hi - lo); },
    pick: function (rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; },
    /** Corta texto en líneas de máximo `cols` caracteres (la fuente pixel es monoespaciada). */
    wrap: function (text, cols) {
      var words = String(text).split(' '), lines = [], cur = '';
      words.forEach(function (w) {
        if (cur && (cur + ' ' + w).length > cols) { lines.push(cur); cur = w; }
        else cur = cur ? cur + ' ' + w : w;
      });
      if (cur) lines.push(cur);
      return lines;
    }
  };
})();
