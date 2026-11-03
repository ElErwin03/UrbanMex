/* UrbanMex · audio — música relajante de fondo, un tren lejano que pasa cada 60 s y efectos suaves de interfaz.
 *
 *  · Música: una pista tranquila para Menú / Tutorial / Resultado ("menu") y otra más luminosa para el Nivel ("nivel"). Al cambiar de pista la
 *    anterior se apaga con un fundido de 1.8 s (dos canales de música). No se reinicia al cambiar de escena entre pantallas que usan la misma.
 *  · Tren: cada 60 s (el primero a los 20 s) suena una pasada lejana, alternando de izquierda a derecha y al revés, a volumen bajo.
 *  · Efectos: clic, selección de estación, viaje, noticia, moneda, tienda, asalto, suerte, error y fanfarria de ganar / perder, todos suaves.
 *  · Sonido: interruptor SI / NO en AJUSTES del celular y en el Menú; se guarda con el progreso (U.session.audio). Apagado = volumen global 0.
 * Los archivos viven en assets/audio (los genera tools/make_audio.py) y son recursos de audio del proyecto. Los volúmenes (0 a 100) están aquí
 * abajo, a propósito bajos: la música es de fondo y el tren apenas se nota.
 * API de GDevelop usada (verificada en howler-sound-manager.ts): playSound, playMusicOnChannel, getMusicOnChannel, setGlobalVolume; del sonido: fade, stop. */
(function () {
  var U = gdjs.UrbanMex;
  if (U.Audio) return;

  var MUSIC = { menu: { file: 'musica_menu.ogg', vol: 40 }, nivel: { file: 'musica_nivel.ogg', vol: 40 } };
  var TRAINS = ['tren_a.ogg', 'tren_b.ogg'], TRAIN_VOL = 28, TRAIN_EVERY = 60, TRAIN_FIRST = 20;     // segundos
  var SFX = { click: 34, select: 40, viaje: 42, noticia: 44, moneda: 44, tienda: 40, robo: 48, suerte: 40, error: 36, ganar: 48, perder: 44 };   // sfx_<nombre>.ogg
  var FADE = 1.8;

  var st = { t: 0, music: null, ch: 0, trainIn: TRAIN_FIRST, trains: 0, fading: [], applied: null };

  function mgr(scene) { try { var g = scene.getGame(), m = g && g.getSoundManager && g.getSoundManager(); return m || null; } catch (e) { return null; } }
  function on() { return U.session.audio !== false; }
  function apply(m) { var v = on() ? 100 : 0; if (st.applied !== v) { m.setGlobalVolume(v); st.applied = v; } }   // apagar = volumen global 0 (la música sigue "corriendo" en silencio)

  /** Cambia de pista de música (si ya suena esa, no hace nada): la anterior baja con un fundido y la nueva entra en el otro canal. */
  function setMusic(m, track) {
    if (st.music === track) return;
    var spec = MUSIC[track], old = st.music !== null ? m.getMusicOnChannel(st.ch) : null;
    if (old) { old.fade(MUSIC[st.music].vol / 100, 0, FADE * 1000); st.fading.push({ s: old, left: FADE + 0.3 }); }
    st.ch = 1 - st.ch; st.music = track;
    m.playMusicOnChannel(spec.file, st.ch, true, spec.vol, 1);
  }

  U.Audio = {
    state: st, MUSIC: MUSIC, SFX: SFX, TRAINS: TRAINS, TRAIN_EVERY: TRAIN_EVERY, TRAIN_FIRST: TRAIN_FIRST,
    enabled: on,

    /** Una vez por fotograma desde cada escena: track = 'menu' | 'nivel'. Mantiene la música, los fundidos y el tren de cada 60 s. */
    tick: function (scene, track, dt) {
      var m = mgr(scene); if (!m) return;
      st.t += dt; apply(m); setMusic(m, track);
      st.fading = st.fading.filter(function (f) { f.left -= dt; if (f.left > 0) return true; f.s.stop(); return false; });
      st.trainIn -= dt;
      if (st.trainIn <= 0) { st.trainIn += TRAIN_EVERY; st.trains++; if (on()) m.playSound(TRAINS[st.trains % 2], false, TRAIN_VOL, 1); }
    },

    /** Efecto de interfaz suave (nombre de SFX). */
    play: function (scene, name) {
      var m = mgr(scene); if (!m || !on() || SFX[name] === undefined) return;
      m.playSound('sfx_' + name + '.ogg', false, SFX[name], 1);
    },

    /** Enciende / apaga todo el sonido y lo guarda. */
    toggle: function (scene) {
      U.session.audio = !on(); U.Save.persist();
      var m = mgr(scene); if (m) apply(m);
      if (on()) this.play(scene, 'select');
    },

    /** Botón SI / NO de sonido (AJUSTES y Menú). */
    button: function (ui, scene, id, x, y, w, h, label) {
      var a = on();
      if (ui.button(id, (label || 'SONIDO') + ': ' + (a ? 'SI' : 'NO'), x, y, w, h, { size: 8, fill: a ? '39;174;96' : '110;60;60' })) this.toggle(scene);
    }
  };
})();
