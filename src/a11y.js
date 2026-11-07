/* UrbanMex · a11y — accesibilidad.
 *
 *  · EFECTOS VISUALES: altos / bajos / ninguno (antes solo se cambiaba en código). Luces, partículas y sombras; se aplica al empezar el nivel o el menú.
 *  · REDUCIR MOVIMIENTO: sin sacudidas, destellos ni parpadeos; los avisos quedan fijos. Se aplica al instante (por si eres sensible a los destellos).
 *  · Los avisos no dependen solo del color: el recurso que se agota lleva además un "!" (ver scene-nivel.js) y todo lo que se oye también se ve.
 *  Los ajustes viven en U.session (fxQuality, calm) y se guardan con U.Save. El panel es el mismo en el menú, la pausa y el celular. */
(function () {
  var U = gdjs.UrbanMex;
  if (U.A11y) return;
  var PAL = U.UI.PAL, util = U.util;
  var LEVELS = [['high', 'ALTOS'], ['low', 'BAJOS'], ['off', 'NINGUNO']];
  var HINT_FX = 'Luces, particulas y sombras. NINGUNO es lo mas ligero. Se aplica al empezar el nivel o el menu.';
  var HINT_CALM = 'Sin sacudidas, destellos ni parpadeos: los avisos quedan fijos. Se aplica al instante.';
  var NOTE = 'Todo aviso se ve y se oye. El apuro marca con "!" el recurso que se agota, ademas del rojo.';

  /** Posiciones del panel para un ancho dado (las comparten el dibujo y el alto). */
  function layout(w) {
    var cols = Math.max(20, Math.floor(w / 8)), L = { fx: util.wrap(HINT_FX, cols), calm: util.wrap(HINT_CALM, cols), note: util.wrap(NOTE, cols) };
    L.btnY = 20; L.fxY = 58; L.calmLabelY = L.fxY + L.fx.length * 12 + 18; L.calmBtnY = L.calmLabelY + 20; L.calmY = L.calmBtnY + 40;
    L.noteY = L.calmY + L.calm.length * 12 + 18; L.h = L.noteY + L.note.length * 12;
    return L;
  }

  var A11y = {
    LEVELS: LEVELS,
    /** 'high' | 'low' | 'off' (lo desconocido cuenta como 'high'). */
    quality: function () { var q = U.session.fxQuality; return q === 'low' || q === 'off' ? q : 'high'; },
    calm: function () { return U.session.calm === true; },
    /** true / false que se alternan `rate` veces por segundo; con REDUCIR MOVIMIENTO se queda fijo en true (aviso encendido, sin parpadeo). */
    blink: function (t, rate) { return A11y.calm() ? true : Math.floor(t * rate) % 2 === 0; },
    setQuality: function (q) { U.session.fxQuality = q === 'low' || q === 'off' ? q : 'high'; U.Save.persist(); },
    setCalm: function (on) { U.session.calm = !!on; U.Save.persist(); },
    /** Alto que ocupa el panel con ancho `w`. */
    height: function (w) { return layout(w).h; },

    /** Panel de accesibilidad en (x, y) con ancho w. `id` distingue los botones; modal: dibuja sobre una ventana. Devuelve el alto. */
    panel: function (ui, scene, id, x, y, w, modal) {
      var L = layout(w), mo = modal ? { modal: true } : {}, tz = modal ? { z: 330 } : {}, gap = 6, bw = Math.floor((w - 2 * gap) / 3), cur = A11y.quality();
      ui.text(id + 'fl', 'EFECTOS VISUALES', x, y, Object.assign({ size: 8 }, tz));
      LEVELS.forEach(function (lv, i) {
        var on = cur === lv[0];
        if (ui.button(id + 'fx' + lv[0], lv[1], x + i * (bw + gap), y + L.btnY, bw, 30, Object.assign({ size: 8, fill: on ? '39;174;96' : '60;60;90' }, mo))) A11y.setQuality(lv[0]);
      });
      ui.lines(id + 'fh', L.fx, x, y + L.fxY, Object.assign({ size: 8, lineH: 12, color: PAL.dim }, tz));
      ui.text(id + 'cl', 'REDUCIR MOVIMIENTO', x, y + L.calmLabelY, Object.assign({ size: 8 }, tz));
      var calm = A11y.calm();
      if (ui.button(id + 'calm', calm ? 'SI' : 'NO', x, y + L.calmBtnY, w, 30, Object.assign({ size: 8, fill: calm ? '39;174;96' : '60;60;90' }, mo))) A11y.setCalm(!calm);
      ui.lines(id + 'ch', L.calm, x, y + L.calmY, Object.assign({ size: 8, lineH: 12, color: PAL.dim }, tz));
      ui.lines(id + 'nh', L.note, x, y + L.noteY, Object.assign({ size: 8, lineH: 12, color: '150;160;200' }, tz));
      return L.h;
    }
  };
  U.A11y = A11y;
})();
