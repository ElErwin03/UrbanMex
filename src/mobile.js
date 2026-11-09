/* UrbanMex · mobile — INTERFAZ GRANDE para celular (puro salvo la medición del lienzo).
 *
 * El juego se dibuja en 1280x720 y GDevelop escala el lienzo para que quepa en la ventana. En un celular horizontal (~0.5x) el texto de 8 px
 * (casi todo) queda de ~4 px y los botones de ~36 px de ~18 px: ilegible y difícil de tocar. En "modo celular":
 *   · los textos chicos se agrandan (5→8, 8→12, 12→16; los de 16 o más ya se leen) y los botones nunca bajan de MIN_BTN px de alto;
 *   · el mapa se acerca con dos dedos (pellizcar) y los botones no se quedan "pegados" por el último toque (no hay cursor que pasa por encima).
 * Se activa solo (`auto`: el lienzo se ve a menos de ON_BELOW de su tamaño real) o a mano en AJUSTES: AUTO / GRANDE / NORMAL (`uiMode` en el guardado). */
(function () {
  var U = gdjs.UrbanMex;
  if (U.Mobile) return;

  var MODES = [['auto', 'AUTO'], ['on', 'GRANDE'], ['off', 'NORMAL']];
  var SIZE = { 5: 8, 8: 12, 12: 16 };         // tamaño normal -> tamaño en modo celular (lo demás queda igual)
  var ON_BELOW = 0.68, OFF_ABOVE = 0.74;      // histéresis (escala del lienzo en pantalla) para no parpadear al cambiar de tamaño
  var MIN_BTN = 44;                            // alto mínimo de un botón en modo celular (px lógicos)
  var state = { scale: 1, on: false, frame: 0 };

  /** Escala con la que se ve el lienzo (alto en pantalla / 720), o 1 si no se puede medir (pruebas, motor simulado). */
  function measure(scene) {
    try {
      var c = scene.getGame().getRenderer().getCanvas(), r = c && c.getBoundingClientRect && c.getBoundingClientRect();
      return r && r.height > 0 ? r.height / 720 : 1;
    } catch (e) { return 1; }
  }

  var Mobile = {
    MODES: MODES, SIZE: SIZE, MIN_BTN: MIN_BTN, ON_BELOW: ON_BELOW, OFF_ABOVE: OFF_ABOVE,
    mode: function () { var m = U.session.uiMode; return m === 'on' || m === 'off' ? m : 'auto'; },
    setMode: function (m) { U.session.uiMode = m === 'on' || m === 'off' ? m : 'auto'; state.frame = 0; U.Save.persist(); },
    /** ¿Interfaz grande ahora? (se mide cada medio segundo; en 'auto' con histéresis). */
    active: function (scene) {
      var m = Mobile.mode(); if (m !== 'auto') return m === 'on';
      if (state.frame-- <= 0) { state.frame = 30; state.scale = measure(scene); state.on = state.on ? state.scale < OFF_ABOVE : state.scale < ON_BELOW; }
      return state.on;
    },
    /** Tamaño de letra en modo celular (si `on`). */
    fs: function (size, on) { return on && SIZE[size] ? SIZE[size] : size; },
    /** Para las pruebas: olvida lo medido. */
    reset: function () { state.scale = 1; state.on = false; state.frame = 0; }
  };
  U.Mobile = Mobile;
})();
