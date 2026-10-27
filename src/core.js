/* UrbanMex · core — espacio de nombres, sesión y utilidades.
 * Todo el juego cuelga de gdjs.UrbanMex. Este archivo no depende del motor: se puede probar en Node. */
(function () {
  var root = typeof globalThis !== 'undefined' ? globalThis : window;
  root.gdjs = root.gdjs || {};
  var U = (gdjs.UrbanMex = gdjs.UrbanMex || {});
  if (U.util) return; // ya cargado (los eventos externos se ejecutan cada fotograma)

  U.VERSION = '2.0.0';
  // Estado que sobrevive al cambio de escena (menú → nivel → resultado → nivel...)
  U.session = { levelIndex: 0, lastResult: null, completed: [] };

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
