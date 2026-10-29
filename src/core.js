/* UrbanMex · core — espacio de nombres, sesión y utilidades.
 * Todo el juego cuelga de gdjs.UrbanMex. Este archivo no depende del motor: se puede probar en Node. */
(function () {
  var root = typeof globalThis !== 'undefined' ? globalThis : window;
  root.gdjs = root.gdjs || {};
  var U = (gdjs.UrbanMex = gdjs.UrbanMex || {});
  if (U.util) return; // ya cargado (los eventos externos se ejecutan cada fotograma)

  U.VERSION = '2.0.0';
  // Estado que sobrevive al cambio de escena (menú → nivel → resultado → nivel...)
  U.session = { levelIndex: 0, lastResult: null, completed: [], dblTravel: true, loaded: false };   // completed: índices de niveles ganados (se guardan); dblTravel: ajuste del celular

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
      if (d.seenTutorial) U.session.seenTutorial = true;
      if (typeof d.dblTravel === 'boolean') U.session.dblTravel = d.dblTravel;
    },
    persist: function () {
      try {
        var st = this._store(); if (!st) return;
        st.setItem(this.KEY, JSON.stringify({ v: 1, completed: U.session.completed.slice().sort(function (a, b) { return a - b; }),
                                               seenTutorial: !!U.session.seenTutorial, dblTravel: U.session.dblTravel !== false }));
      } catch (e) { /* sin almacenamiento: el progreso dura solo la sesión */ }
    },
    isCompleted: function (idx) { return U.session.completed.indexOf(idx) >= 0; },
    markCompleted: function (idx) { if (!this.isCompleted(idx)) { U.session.completed.push(idx); this.persist(); } },
    /** Nivel al que lleva JUGAR: el primero que aún no has completado (o el último si ya completaste todos). */
    nextLevel: function (total) {
      for (var i = 0; i < total; i++) if (!this.isCompleted(i)) return i;
      return Math.max(0, total - 1);
    },
    reset: function () { U.session.completed = []; this.persist(); }
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
