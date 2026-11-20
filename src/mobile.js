/* UrbanMex · mobile — INTERFAZ GRANDE para celular (puro salvo la medición del lienzo).
 *
 * El juego se dibuja en 1280x720 y GDevelop escala el lienzo para que quepa en la ventana. En un celular horizontal (~0.5x) el texto de 8 px
 * (casi todo) queda de ~4 px y los botones de ~36 px de ~18 px: ilegible y difícil de tocar. En "modo celular":
 *   · los textos chicos se agrandan (5→8, 8→12, 12→16; los de 16 o más ya se leen) y los botones nunca bajan de MIN_BTN px de alto;
 *   · el mapa se acerca con dos dedos (pellizcar) y los botones no se quedan "pegados" por el último toque (no hay cursor que pasa por encima).
 * Se activa solo (`auto`: el lienzo se ve a menos de ON_BELOW de su tamaño real) o a mano en AJUSTES: AUTO / GRANDE / NORMAL (`uiMode` en el guardado).
 *
 * Además, en un celular el lienzo 16:9 se ve MUY chico si la pantalla está en vertical (~0.3x) o dentro del marco de itch.io (~0.4x). Por eso:
 *   · `needsRotate`: pantalla táctil en vertical → aviso "GIRA TU CELULAR" (con PANTALLA COMPLETA y JUGAR ASI para quien tenga bloqueada la rotación);
 *   · `fullscreen*`: botón de pantalla completa (y se intenta bloquear en horizontal);
 *   · `mapLabel`: los nombres de estación del mapa (que viven dentro del mundo y se encogen con el zoom) se agrandan para verse de ~10 px reales. */
(function () {
  var U = gdjs.UrbanMex;
  if (U.Mobile) return;

  var MODES = [['auto', 'AUTO'], ['on', 'GRANDE'], ['off', 'NORMAL']];
  var SIZE = { 5: 8, 8: 12, 12: 16 };         // tamaño normal -> tamaño en modo celular (lo demás queda igual)
  var ON_BELOW = 0.68, OFF_ABOVE = 0.74;      // histéresis (escala del lienzo en pantalla) para no parpadear al cambiar de tamaño
  var MIN_BTN = 44;                            // alto mínimo de un botón en modo celular (px lógicos)
  var state = { scale: 1, on: false, frame: 0, dismissed: false };
  var REAL_KEY = 13, REAL_NEAR = 10;           // alto mínimo (px reales de pantalla) de los nombres del mapa: clave / demás
  var CAP_KEY = 34, CAP_NEAR = 28;             // tope en px lógicos (con zoom muy chico no se llena el mapa de letras gigantes)
  var win = function () { return typeof window !== 'undefined' ? window : null; };

  /** Escala con la que se ve el lienzo (alto en pantalla / 720), o 1 si no se puede medir (pruebas, motor simulado). */
  function measure(scene) {
    try {
      var c = scene.getGame().getRenderer().getCanvas(), r = c && c.getBoundingClientRect && c.getBoundingClientRect();
      return r && r.height > 0 ? r.height / 720 : 1;
    } catch (e) { return 1; }
  }

  function doc() { return typeof document !== 'undefined' ? document : null; }
  function renderer(scene) { try { return scene.getGame().getRenderer(); } catch (e) { return null; } }

  var Mobile = {
    MODES: MODES, SIZE: SIZE, MIN_BTN: MIN_BTN, ON_BELOW: ON_BELOW, OFF_ABOVE: OFF_ABOVE,
    mode: function () { var m = U.session.uiMode; return m === 'on' || m === 'off' ? m : 'auto'; },
    setMode: function (m) { U.session.uiMode = m === 'on' || m === 'off' ? m : 'auto'; state.frame = 0; U.Save.persist(); },
    /** ¿Interfaz grande ahora? (se mide cada medio segundo; en 'auto' con histéresis). */
    active: function (scene) {
      Mobile.scale(scene); var m = Mobile.mode(); if (m !== 'auto') return m === 'on';
      return state.on;
    },
    /** Escala con la que se ve el lienzo ahora (se mide cada medio segundo, en cualquier modo). */
    scale: function (scene) {
      if (state.frame-- <= 0) { state.frame = 30; state.scale = measure(scene); state.on = state.on ? state.scale < OFF_ABOVE : state.scale < ON_BELOW; }
      return state.scale;
    },
    /** ¿Pantalla táctil? (en una PC con ratón no se muestran los avisos de celular) */
    touchCapable: function () { var n = typeof navigator !== 'undefined' ? navigator : null; return !!(n && n.maxTouchPoints > 0); },
    /** ¿Ventana en vertical? */
    portrait: function () { var w = win(); return !!(w && w.innerHeight > w.innerWidth * 1.05); },
    /** ¿Hay que mostrar el aviso de girar el celular? Solo con pantalla táctil en vertical y mientras no se haya descartado
     *  (si luego se gira a horizontal, el descarte se olvida: la próxima vez que se ponga en vertical vuelve a avisar). */
    needsRotate: function () {
      var p = Mobile.touchCapable() && Mobile.portrait(); if (!p) state.dismissed = false;
      return p && !state.dismissed;
    },
    dismissRotate: function () { state.dismissed = true; },
    /** ¿Se puede pedir pantalla completa? (el iPhone no lo permite: ahí solo queda girar el celular) */
    fullscreenSupported: function (scene) {
      var d = doc(), r = renderer(scene);
      return !!((d && (d.fullscreenEnabled || d.webkitFullscreenEnabled)) && r && (r.setFullScreen || d.documentElement.requestFullscreen));
    },
    isFullscreen: function (scene) {
      var d = doc(); if (d && 'fullscreenElement' in d) return !!(d.fullscreenElement || d.webkitFullscreenElement);
      var r = renderer(scene); return !!(r && r.isFullScreen && r.isFullScreen());
    },
    /** Entra o sale de pantalla completa (hay que llamarla justo después de un toque). Al entrar intenta bloquear la horizontal. */
    toggleFullscreen: function (scene) {
      var d = doc(), r = renderer(scene), on = !Mobile.isFullscreen(scene);
      try {
        if (r && r.setFullScreen) r.setFullScreen(on);
        else if (d && on) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen).call(d.documentElement);
        else if (d && d.exitFullscreen) d.exitFullscreen();
        var so = typeof screen !== 'undefined' ? screen.orientation : null;
        if (on && so && so.lock) { var p = so.lock('landscape'); if (p && p.catch) p.catch(function () {}); }
      } catch (e) { /* sin permiso: el navegador no deja */ }
      return on;
    },
    /** Tamaño lógico del nombre de una estación en el mapa. Fuera de modo celular, el de siempre (`base`, ya ajustado al zoom).
     *  En modo celular se agranda hasta ~REAL px reales de pantalla: lógico × zoom del mapa × escala del lienzo. */
    mapLabel: function (scene, base, zoom, key) {
      if (!Mobile.active(scene)) return base;
      var want = Math.ceil((key ? REAL_KEY : REAL_NEAR) / (Math.max(0.1, zoom) * Math.max(0.15, state.scale)));
      return Math.max(Mobile.fs(base, true), Math.min(want, key ? CAP_KEY : CAP_NEAR));
    },
    /** Tamaño de letra en modo celular (si `on`). */
    fs: function (size, on) { return on && SIZE[size] ? SIZE[size] : size; },
    /** Para las pruebas: olvida lo medido. */
    reset: function () { state.scale = 1; state.on = false; state.frame = 0; state.dismissed = false; }
  };
  U.Mobile = Mobile;
})();
