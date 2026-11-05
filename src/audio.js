/* UrbanMex · audio — música relajante de fondo, un tren lejano cada 60 s, efectos suaves, y el sonido de peligro / apuro.
 *
 * TRES MÓDULOS, cada uno con su volumen (0 a 10, el 7 es el nivel "de fábrica") y su silencio:
 *   · "music"  MÚSICA GENERAL     — la música de fondo (una pista tranquila para Menú / Tutorial / Resultado y otra para el Nivel).
 *   · "sfx"    SONIDOS GENERALES  — clic, selección, viaje, noticia, moneda, tienda, suerte, error, ganar / perder y el tren lejano de cada 60 s.
 *   · "alert"  PELIGRO Y APURO    — el latido con tic de reloj que suena mientras te quede MENOS DEL 15 % del tiempo o del dinero, y el
 *                                   golpe seco del asalto. Mientras suena el apuro la música baja un poco para que se note.
 * El volumen real de cada sonido es (su volumen base de esta tabla) × (nivel / 7); silenciado = 0. Se guarda con el progreso (U.session.vol).
 * Los archivos viven en assets/audio (los genera tools/make_audio.py) y son recursos de audio del proyecto. Los volúmenes base (0 a 100) están
 * aquí abajo, a propósito bajos: la música es de fondo y el tren apenas se nota.
 * API de GDevelop usada (verificada en howler-sound-manager.ts): playSound, playMusicOnChannel, getMusicOnChannel; del sonido: setVolume, fade, stop. */
(function () {
  var U = gdjs.UrbanMex, PAL = U.UI.PAL;
  if (U.Audio) return;

  var MUSIC = { menu: { file: 'musica_menu.ogg', vol: 40 }, nivel: { file: 'musica_nivel.ogg', vol: 40 } };
  var TRAINS = ['tren_a.ogg', 'tren_b.ogg'], TRAIN_VOL = 28, TRAIN_EVERY = 60, TRAIN_FIRST = 20;     // segundos
  var SFX = { click: 34, select: 40, viaje: 42, noticia: 44, moneda: 44, tienda: 40, suerte: 40, error: 36, ganar: 48, perder: 44, asalto: 46 };   // sfx_<nombre>.ogg
  var GROUP_OF = { asalto: 'alert' };                        // todo lo demás de SFX es "sfx"
  var ALERT = { file: 'peligro_loop.ogg', vol: 30, ch: 2, fadeIn: 1.6, fadeOut: 1.2, low: 0.15, duck: 0.6 };   // bucle de apuro, canal de música propio; low: umbral; duck: la música baja a 60 %
  var STEPS = 10, DEFAULT = 7;                                // niveles 0..10; el 7 deja los volúmenes base tal cual
  var FADE = 1.8, PREVIEW_GAP = 0.7;
  var GROUPS = [
    { id: 'music', label: 'MUSICA GENERAL', hint: 'Musica relajante de fondo', color: '70;130;220' },
    { id: 'sfx', label: 'SONIDOS GENERALES', hint: 'Clics, tren, noticias, tienda', color: '46;174;96' },
    { id: 'alert', label: 'PELIGRO Y APURO', hint: 'Apuro y golpe de asalto', color: '235;120;50' }
  ];

  var st = { t: 0, music: null, ch: 0, mv: 1, mvApplied: -1, trainIn: TRAIN_FIRST, trains: 0, fading: [], al: null, alv: 0, alApplied: -1, lastPreview: -9 };

  function mgr(scene) { try { var g = scene.getGame(), m = g && g.getSoundManager && g.getSoundManager(); return m || null; } catch (e) { return null; } }
  function slot(g) { return U.session.vol[g]; }
  /** Ganancia de un módulo: 0 si está en silencio; 1 en el nivel 7 (de fábrica); hasta 10/7 en el nivel 10. */
  function gain(g) { var s = slot(g); return s.mute ? 0 : s.level / DEFAULT; }
  function pct(v, g) { return Math.max(0, Math.min(100, v * g)); }

  /** Cambia de pista de música (si ya suena esa, no hace nada): la anterior baja con un fundido y la nueva entra en el otro canal. */
  function setMusic(m, track) {
    if (st.music === track) return;
    var spec = MUSIC[track], old = st.music !== null ? m.getMusicOnChannel(st.ch) : null;
    if (old) { old.fade(Math.min(1, MUSIC[st.music].vol * st.mv / 100), 0, FADE * 1000); st.fading.push({ s: old, left: FADE + 0.3 }); }
    st.ch = 1 - st.ch; st.music = track;
    m.playMusicOnChannel(spec.file, st.ch, true, pct(spec.vol, st.mv), 1);
    st.mvApplied = st.mv;
  }

  /** Volumen vivo de la música: sigue al nivel del módulo y baja mientras suena el apuro; el cambio es suave (sin saltos). */
  function musicLevel(m, dt, alertOn) {
    var want = gain('music') * (alertOn ? ALERT.duck : 1);
    st.mv += (want - st.mv) * Math.min(1, dt * 3);
    if (Math.abs(want - st.mv) < 0.002) st.mv = want;
    if (st.mv !== st.mvApplied && st.music !== null) {
      var s = m.getMusicOnChannel(st.ch); if (s) s.setVolume(Math.min(1, MUSIC[st.music].vol * st.mv / 100));
      st.mvApplied = st.mv;
    }
  }

  /** Bucle de apuro: entra con un fundido mientras `want`, sale con otro, y se detiene del todo al terminar de apagarse. */
  function alertLoop(m, dt, want) {
    var g = gain('alert'), on = want && g > 0, target = on ? Math.min(1, ALERT.vol * g / 100) : 0;
    if (on && !st.al) { m.playMusicOnChannel(ALERT.file, ALERT.ch, true, 0, 1); st.al = m.getMusicOnChannel(ALERT.ch); st.alv = 0; st.alApplied = -1; }
    if (!st.al) return;
    var rate = (ALERT.vol * 1.43 / 100) / (target >= st.alv ? ALERT.fadeIn : ALERT.fadeOut) * dt;
    st.alv += Math.max(-rate, Math.min(rate, target - st.alv));
    if (st.alv !== st.alApplied) { st.al.setVolume(st.alv); st.alApplied = st.alv; }
    if (!on && st.alv <= 0.0005) { st.al.stop(); st.al = null; st.alv = 0; }
  }

  U.Audio = {
    state: st, MUSIC: MUSIC, SFX: SFX, TRAINS: TRAINS, TRAIN_EVERY: TRAIN_EVERY, TRAIN_FIRST: TRAIN_FIRST, ALERT: ALERT, GROUPS: GROUPS, STEPS: STEPS, DEFAULT: DEFAULT,
    gain: gain, level: function (g) { return slot(g).level; }, muted: function (g) { return slot(g).mute; },

    /** ¿Estás en apuro? Queda menos del 15 % del tiempo del día o del dinero con el que empezó el nivel (y la partida sigue). */
    danger: function (run) {
      if (!run || run.over) return false;
      var cfg = run.data.config, span = cfg.dayEndMinute - cfg.dayStartMinute, ms = run.level.moneyStart;
      return (cfg.dayEndMinute - run.minute) / span < ALERT.low || (ms > 0 && run.money / ms < ALERT.low);
    },

    /** Una vez por fotograma desde cada escena: track = 'menu' | 'nivel'; opts.alert = true en el Nivel cuando hay apuro.
     *  Mantiene la música, los fundidos, el bucle de apuro y el tren de cada 60 s. */
    tick: function (scene, track, dt, opts) {
      var m = mgr(scene); if (!m) return;
      U.Save.load();                                                       // los volúmenes guardados valen desde el primer fotograma (no hay "salto" al arrancar)
      if (!st.ready) { st.ready = true; st.mv = gain('music'); }
      var alertOn = !!(opts && opts.alert) && gain('alert') > 0;
      st.t += dt; musicLevel(m, dt, alertOn); setMusic(m, track); alertLoop(m, dt, !!(opts && opts.alert));
      st.fading = st.fading.filter(function (f) { f.left -= dt; if (f.left > 0) return true; f.s.stop(); return false; });
      st.trainIn -= dt;
      if (st.trainIn <= 0) { st.trainIn += TRAIN_EVERY; st.trains++; if (gain('sfx') > 0) m.playSound(TRAINS[st.trains % 2], false, pct(TRAIN_VOL, gain('sfx')), 1); }
    },

    /** Efecto de sonido (nombre de SFX); suena con el volumen de su módulo y nada si está en silencio. */
    play: function (scene, name) {
      var m = mgr(scene); if (!m || SFX[name] === undefined) return;
      var g = gain(GROUP_OF[name] || 'sfx'); if (g <= 0) return;
      m.playSound('sfx_' + name + '.ogg', false, pct(SFX[name], g), 1);
    },

    /** Sube o baja un paso el volumen de un módulo (0..10) y lo guarda. Un efecto de muestra deja oír el nuevo nivel. */
    step: function (scene, g, dir) { this.setLevel(scene, g, slot(g).level + dir); },
    setLevel: function (scene, g, n) {
      var s = slot(g), v = Math.max(0, Math.min(STEPS, Math.round(n)));
      if (v === s.level && !s.mute) return;
      s.level = v; if (v > 0) s.mute = false; U.Save.persist(); this.preview(scene, g);
    },
    /** Silencia / reactiva un módulo y lo guarda. */
    toggleMute: function (scene, g) {
      var s = slot(g); s.mute = !s.mute; if (!s.mute && s.level === 0) s.level = 1; U.Save.persist(); if (!s.mute) this.preview(scene, g);
    },
    /** Muestra breve del módulo (la música se oye en vivo; los otros dos suenan una vez, sin repetirse en menos de 0.7 s). */
    preview: function (scene, g) {
      if (g === 'music' || st.t - st.lastPreview < PREVIEW_GAP) return;
      st.lastPreview = st.t; this.play(scene, g === 'alert' ? 'asalto' : 'select');
    },

    /** Los tres módulos (música general, sonidos generales, peligro y apuro): nombre y %, barra de 10 pasos (se toca un paso), − / + y MUDO.
     *  Devuelve el alto que ocupa. `id` distingue los botones; `hints` muestra la línea de descripción. */
    panel: function (ui, scene, id, x, y, w, hints) {
      var self = this, rowH = hints === false ? 62 : 80;
      GROUPS.forEach(function (G, i) {
        var s = slot(G.id), ry = y + i * rowH, muted = s.mute, k = id + G.id;
        ui.text(k + 't', G.label, x, ry, { size: 8, color: muted ? PAL.dim : '255;255;255' });
        ui.text(k + 'p', muted ? 'MUDO' : s.level * 10 + '%', x + w, ry, { size: 8, align: 'right', color: muted ? PAL.red : PAL.yellow });
        var cy = ry + (hints === false ? 16 : 32);
        if (hints !== false) ui.text(k + 'h', G.hint, x, ry + 15, { size: 8, color: PAL.dim });
        var bw = 30, mw = 76, gap = 4, barW = w - 2 * bw - mw - 3 * gap - 4, seg = Math.floor(barW / STEPS), bx = x + bw + gap;
        if (ui.button(k + '-', '-', x, cy, bw, 30, { size: 12, fill: '70;70;100' })) self.step(scene, G.id, -1);
        ui.rect(bx - 2, cy, seg * STEPS + 4, 30, { fill: '10;10;20', border: '90;90;120', bw: 2 });
        for (var j = 0; j < STEPS; j++) {                                           // barra de 10 pasos: tocar uno fija ese volumen
          var sx = bx + j * seg, on = j < s.level && !muted;
          ui.rect(sx + 1, cy + 5, seg - 2, 20, { fill: on ? G.color : '34;34;58', bw: 0 });
          if (ui.inside(sx, cy, seg, 30) && ui.released) self.setLevel(scene, G.id, j + 1);
        }
        if (ui.button(k + '+', '+', bx + seg * STEPS + gap + 2, cy, bw, 30, { size: 12, fill: '70;70;100' })) self.step(scene, G.id, 1);
        if (ui.button(k + 'm', muted ? 'ACTIVAR' : 'MUDO', x + w - mw, cy, mw, 30, { size: 8, fill: muted ? '39;174;96' : '110;60;60' })) self.toggleMute(scene, G.id);
      });
      return GROUPS.length * rowH;
    }
  };
})();
