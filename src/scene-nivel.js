/* UrbanMex · escena Nivel — una jornada: viajar por el Metro de la CDMX antes de que anochezca.
 * Cada fotograma: dibuja la interfaz → procesa entrada → avanza el reloj de noticias → actualiza el mapa. */
(function () {
  var U = gdjs.UrbanMex, util = U.util, PAL = U.UI.PAL, R = U.Rules, N = U.News;
  if (U.Scenes && U.Scenes.nivel) return;
  U.Scenes = U.Scenes || {};

  var REASON = { stamina: 'SIN STAMINA', money: 'SIN DINERO', night: 'ANOCHECE', blocked: 'BLOQUEADA', no_connection: 'NO CONECTADA' };

  function wrapLines(lines, cols) { return [].concat.apply([], [].concat(lines).map(function (l) { return l === '' ? [''] : util.wrap(l, cols); })); }   // conserva las líneas en blanco
  function snd(um, name) { U.Audio.play(um.ui.scene, name); }   // efecto de sonido suave (audio.js)
  function float(um, text, color) { um.floats.push({ text: text, color: color, t: 0 }); if (um.floats.length > 4) um.floats.shift(); }

  /** Ventana modal. o: {title, lines[], buttons:[{label, kind:'safe'|'danger'|'neutral', action}]}. Se encolan si ya hay una abierta. */
  function modal(um, o) { if (um.modal) um.modalQueue.push(o); else um.modal = o; }
  function closeModal(um, btn) {
    um.modal = um.modalQueue.shift() || null;
    if (btn && btn.action) btn.action();
  }

  function init(scene, data) {
    U.Save.load();
    var inf = U.session.infinite, um = scene._um = { data: data, run: R.createRun(data, inf ? -1 : U.session.levelIndex, undefined, inf ? U.Infinite.level(data, inf.seed, inf.round) : undefined), ui: U.UI.of(scene), phone: U.Phone.newPhoneState(),
      selected: null, modal: null, modalQueue: [], floats: [], push: null, hover: null, pending: null, lastClick: null, endTimer: 0, exitToMenu: false, paused: false, pauseView: 'main', hurt: 0,
      drag: { active: false, moved: false, sx: 0, sy: 0, lx: 0, ly: 0 } };
    var run = um.run;
    um.map = new U.MapView(scene, data);
    um.fx = U.FX.level(scene, um);                              // iluminación dinámica, partículas y atmósfera (fx.js)
    um.setPhone = function (open) { um.phone.open = open; if (!open) um.push = null; um.map.setPhoneOpen(open); };   // mostrar / ocultar el celular
    um.map.placePlayer(run.current);
    N.intro(run);
    var evs = U.Events.status(run).map(function (e) { return e.label + ' (' + e.text + ')'; });   // eventos del día, si el nivel los tiene
    modal(um, { title: U.Infinite.title(run.level),
      lines: [run.level.startDesc, '', 'Meta: ' + (run.level.infinite ? U.Infinite.nice(run.level.goal) : run.level.goal), 'Llega antes de las ' + util.clock(data.config.dayEndMinute) + '.']
        .concat(run.level.infinite ? ['Racha: ' + inf.cleared + (inf.cleared === 1 ? ' ronda' : ' rondas') + ' - ' + inf.stars + ' estrellas'] : [])
        .concat(evs.length ? ['', 'Hoy: ' + evs.join(', ') + '.'] : []).concat(['', 'Lee las noticias del celular: son tu unica guia.']),
      buttons: [{ label: 'EMPEZAR', kind: 'safe' }] });
    return um;
  }

  // ---------------------------------------------------------------- acciones
  function select(um, id) { um.selected = id; }

  function travel(um, id) {
    var run = um.run, from = run.current, out = R.travel(run, id);
    if (!out.ok) { var why = R.explain(run, id); float(um, why ? why.short : 'NO SE PUEDE', PAL.red); snd(um, 'error'); return; }   // el panel de la estación (ya abierta por el primer clic) explica el motivo
    snd(um, 'viaje'); um.selected = null; if (um.map.cam.zoom > um.map.fitZoom + 0.05) um.map.followPlayer(); um.map.walk(from, id, 0.45);   // con toda la red a la vista la cámara no se mueve
    um.pending = out; float(um, id + '  -' + out.cost.time + ' min', PAL.blue);
  }

  function resolve(um) {
    var out = um.pending, run = um.run; um.pending = null;
    announceEvents(um);                                         // lluvia, hora pico y huelgas que empezaron o terminaron durante el viaje
    var item = N.onMove(run);                                   // las noticias solo ocurren cuando el jugador se mueve
    if (item) { snd(um, 'noticia'); um.push = um.phone.open ? { item: item, t: 0 } : null; if (um.selected && run.blocked[um.selected]) um.selected = null; }
    if (out.type === 'shop') { snd(um, 'tienda'); shopModal(um); }
    else if (out.type === 'robbery') {
      snd(um, 'asalto'); um.fx.robbery(out.stolen); um.hurt = 1.3; float(um, '-$' + out.stolen, PAL.red);   // efectos: destello, sacudida, monedas y el saldo tiembla
      N.info(run, 'ASALTO CONFIRMADO!', 'Te robaron $' + out.stolen + ' en ' + run.current + '.', 'Debiste leer las noticias...');
      modal(um, { title: 'TE ASALTARON!', lines: ['En ' + run.current + ' te quitaron $' + out.stolen + '.', '', '"Debiste haber leido las noticias..."'],
                  buttons: [{ label: 'SEGUIR', kind: 'danger' }] });
    } else if (out.type === 'lucky') {
      N.info(run, 'Pasaste de suerte', 'Ibas por ' + run.current + ' (zona reportada) y no paso nada. Esta vez!', 'Sin incidentes');
      float(um, 'Pasaste de suerte', PAL.green); snd(um, 'suerte');
    }
  }

  function waitStrike(um) {
    var r = R.wait(um.run); if (!r.ok) { float(um, r.reason === 'night' ? 'Reabre ya de noche' : 'Nada que esperar', PAL.red); snd(um, 'error'); return; }
    snd(um, 'click'); um.selected = null; announceEvents(um);                      // el aviso "ESPERASTE n MIN" sale de las noticias de eventos
  }

  /** Anuncia los cambios de eventos del día (los deja Rules en run.eventQueue): sonido, aviso flotante y notificación en el celular. */
  function announceEvents(um) {
    var run = um.run, got = N.drain(run); if (!got.length) return;
    got.forEach(function (g) { float(um, g.title, g.severity === 'success' ? PAL.green : g.severity === 'danger' ? PAL.red : PAL.yellow); });
    snd(um, 'noticia'); var last = got[got.length - 1];
    um.push = um.phone.open ? { item: last.entry, t: 0 } : null;
    if (um.selected && run.blocked[um.selected]) um.selected = null;
  }

  function shopModal(um) {
    var run = um.run, price = R.monsterPrice(run), cfg = run.data.config;
    modal(um, { title: 'TIENDA', lines: ['Comprar Monster Energy?', '$' + price + ' = +' + cfg.monsterStamina + ' stamina', '', 'Saldo: $' + run.money + '   Stamina: ' + Math.floor(run.stamina) + '/' + run.staminaMax],
      buttons: [
        { label: 'COMPRAR', kind: 'safe', action: function () { buy(um); } },
        { label: 'NO', kind: 'neutral' }] });
  }
  function buy(um) {
    var r = R.buyMonster(um.run);
    if (r.ok) { snd(um, 'moneda'); float(um, '+' + r.gained + ' stamina', PAL.yellow); N.info(um.run, 'Monster!', 'Compraste un Monster Energy.', '+' + r.gained + ' stamina'); }
    else { float(um, r.reason === 'full' ? 'Stamina llena' : 'Sin dinero', PAL.red); snd(um, 'error'); }
  }

  function clickMap(um, id) {
    var run = um.run;
    if (!id) { um.selected = null; return; }
    if (id === run.current) { float(um, 'Ya estas aqui', PAL.dim); return; }
    if (run.blocked[id]) { float(um, R.explain(run, id).short, PAL.purple); snd(um, 'error'); return; }
    if (!U.Graph.connected(run.graph, run.current, id)) { float(um, R.explain(run, id).short, PAL.red); snd(um, 'error'); return; }
    select(um, id); snd(um, 'select');
  }

  /** Doble clic en una estación VECINA (conectada a la actual): viaja ahí sin pedir confirmación. Con cualquier otra, actúa como un clic normal. */
  function doubleClick(um, id) {
    var run = um.run;
    if (id === run.current || run.blocked[id] || !U.Graph.connected(run.graph, run.current, id)) { clickMap(um, id); return; }
    travel(um, id);
  }

  function drawHUD(ui, um) {
    var run = um.run, cfg = run.data.config;
    ui.rect(0, 0, 1280, 56, { fill: '12;10;24', border: PAL.orange, bw: 2, block: true });
    ui.text('hud:day', U.Infinite.title(run.level), 14, 10, { size: 8, color: PAL.yellow });
    ui.text('hud:st', run.current, 14, 32, { size: 8 });
    // APURO: el recurso que aprieta (Rules.urgency, la misma regla del sonido) parpadea en rojo; el asalto hace temblar el saldo un momento
    var u = R.urgency(run), flash = U.A11y.blink(um.t, 3), hot = function (v) { return v > 0 && flash; }, hurt = um.hurt > 0;
    ui.icon('hud:i1', 'rayo', 330, 12, 2); ui.bar(368, 18, 150, 16, run.stamina / run.staminaMax, u.stamina > 0 ? '215;45;35' : '243;156;18');
    ui.text('hud:sv', Math.floor(run.stamina) + '', 528, 22, { size: 8, color: hot(u.stamina) ? PAL.red : undefined });
    var jx = hurt && !U.A11y.calm() ? Math.round(Math.sin(um.t * 60) * 4) : 0;
    // el apuro no depende solo del color: un "!" fijo junto al recurso que se agota
    [['stamina', 566, 22, 8], ['money', 724, 20, 16], ['time', 1104, 20, 16]].forEach(function (w) { if (u[w[0]] > 0) ui.text('hud:w' + w[0], '!', w[1], w[2], { size: w[3], color: PAL.red }); });
    ui.icon('hud:i2', 'moneda', 600, 12, 2); ui.text('hud:mv', String(run.money), 640 + jx, 22, { size: 16, color: hurt || hot(u.money) ? PAL.red : PAL.green });
    ui.icon('hud:i3', 'reloj', 780, 12, 2);
    ui.bar(818, 18, 200, 16, (run.minute - cfg.dayStartMinute) / (cfg.dayEndMinute - cfg.dayStartMinute), run.minute >= 1080 || u.time > 0 ? PAL.red : '230;126;34');
    ui.text('hud:tv', util.clock(run.minute), 1030, 22, { size: 8, color: run.minute >= 1140 || hot(u.time) ? PAL.red : PAL.yellow });
  }

  /** Icono de la esquina superior derecha: oculta / muestra el celular. Con el celular oculto avisa (parpadea) si llegan noticias. */
  function drawPhoneToggle(ui, um, run) {
    var open = um.phone.open, alert = !open && run.unread > 0, flash = alert && U.A11y.blink(um.t, 3);
    var fill = open ? '70;70;110' : flash ? '192;57;43' : '60;60;90';
    if (ui.button('phone:tg', '', 1222, 6, 52, 44, { fill: fill })) {
      um.setPhone(!open);
      if (!open && run.unread > 0 && um.phone.app === 'home') um.phone.app = 'news';   // al abrirlo con noticias nuevas, directo a leerlas
    }
    ui.icon('phone:ic', 'celular', 1232, 12, 2);
    if (run.unread > 0 && !open) {
      ui.rect(1250, 2, 26, 18, { fill: PAL.red, border: '255;255;255', bw: 2 });
      ui.text('phone:bd', String(Math.min(run.unread, 99)), 1263, 7, { size: 8, align: 'center', z: 230 });
    }
  }

  function drawControls(ui, um) {   // barra horizontal arriba a la izquierda: no tapa la red encuadrada
    var m = um.map, y = 66, c = { size: 8, fill: '60;60;90' };
    if (ui.mob) {                                                                 // modo celular: botones de 44 px
      ui.rect(16, 62, 376, 52, { fill: '12;10;24', border: '90;90;120', bw: 2, block: true });
      if (ui.button('z-', '-', 22, y, 44, 44, { size: 16, fill: '60;60;90' })) m.zoomBy(-0.2);
      ui.text('zl', Math.round(m.cam.zoom * 100) + '%', 96, y + 16, { size: 8, align: 'center', color: PAL.dim });
      if (ui.button('z+', '+', 126, y, 44, 44, { size: 16, fill: '60;60;90' })) m.zoomBy(0.2);
      if (ui.button('fit', 'TODO', 178, y, 72, 44, c)) m.fit();
      if (ui.button('rc', 'YO', 256, y, 56, 44, c)) { if (m.cam.zoom < 1.4) m.zoomBy(1.4 - m.cam.zoom); m.followPlayer(); }
      if (ui.button('abc', 'ABC', 318, y, 68, 44, { size: 8, fill: m.labelsAll ? '39;174;96' : '60;60;90' })) m.labelsAll = !m.labelsAll;
      return;
    }
    ui.rect(16, 62, 322, 44, { fill: '12;10;24', border: '90;90;120', bw: 2, block: true });
    if (ui.button('z-', '-', 22, y, 34, 32, { size: 16, fill: '60;60;90' })) m.zoomBy(-0.2);
    ui.text('zl', Math.round(m.cam.zoom * 100) + '%', 87, y + 12, { size: 8, align: 'center', color: PAL.dim });
    if (ui.button('z+', '+', 118, y, 34, 32, { size: 16, fill: '60;60;90' })) m.zoomBy(0.2);
    if (ui.button('fit', 'TODO', 160, y, 56, 32, c)) m.fit();                                                    // encuadra toda la red
    if (ui.button('rc', 'YO', 222, y, 40, 32, c)) { if (m.cam.zoom < 1.4) m.zoomBy(1.4 - m.cam.zoom); m.followPlayer(); }
    if (ui.button('abc', 'ABC', 268, y, 64, 32, { size: 8, fill: m.labelsAll ? '39;174;96' : '60;60;90' })) m.labelsAll = !m.labelsAll;   // todos los nombres
  }

  /** Eventos del día (lluvia, hora pico, huelga) en curso o por venir, debajo de la barra de arriba. Los que ya terminaron desaparecen (queda su noticia). */
  var CHIP = { lluvia: '90;170;255', horaPico: '243;156;18', huelga: '192;57;43' };
  function drawEventChips(ui, um) {
    var M = ui.mob, x0 = M ? 400 : 346, x = x0, cy = 62, shown = 0, run = um.run, limit = um.phone.open ? (M ? 826 : 906) : 1272;
    U.Events.status(run).forEach(function (e) {
      if (e.state === 'over') return;
      var on = e.state === 'active', col = CHIP[e.id] || PAL.orange, k = 'ev' + shown, btn = e.id === 'huelga' && on, w, ch = M ? 52 : 44;
      if (M) {                                                                    // el ancho sale del texto (las letras son más grandes)
        w = 44 + Math.max(e.label.length, e.text.length) * 12 + 10 + (btn ? 104 : 0);
        if (x > x0 && x + w > limit) { x = x0; cy += ch + 6; }                    // no cabe en la fila: pasa a la siguiente
      } else w = e.id === 'huelga' ? 236 : 150;
      ui.rect(x, cy, w, ch, { fill: '12;10;24', border: on ? col : '90;90;120', bw: 2, block: true });
      ui.icon(k + ':i', e.icon, x + 6, cy + (M ? 14 : 8), 1.5);
      ui.text(k + ':l', e.label, x + 36, cy + (M ? 8 : 8), { size: 8, color: on ? col : PAL.dim });
      ui.text(k + ':t', e.text, x + 36, cy + (M ? 28 : 24), { size: 8, color: on ? '255;255;255' : PAL.dim });
      var blocked = !!um.modal || !!um.pending || um.map.moving();
      if (btn && M && ui.button(k + ':w', 'ESPERAR', x + w - 100, cy + 4, 96, 44, { size: 8, fill: '70;100;160', disabled: blocked })) waitStrike(um);
      else if (btn && !M && ui.button(k + ':w', 'ESPERAR', x + w - 84, cy + 6, 78, 32, { size: 8, fill: '70;100;160', disabled: blocked })) waitStrike(um);   // pasa el tiempo hasta que reabra
      x += w + 6; shown++;
    });
  }

  function drawLegend(ui, um) {
    var x = 920, y = 636, items = [['persona', 'Tu'], ['meta', 'Meta'], ['tienda', 'Tienda'], ['bloqueo', 'Bloq.'], ['combi', 'Combi']];
    ui.rect(x, y, 340, 76, { fill: '12;10;24', border: '90;90;120', bw: 2, block: true });
    ui.text('lg:t', 'LEYENDA', x + 10, y + 8, { size: 8, color: PAL.orange });
    items.forEach(function (it, i) {
      var ix = x + 10 + (i % 3) * 112, iy = y + 24 + Math.floor(i / 3) * 24;
      ui.icon('lg:i' + i, it[0], ix, iy, 1.5); ui.text('lg:l' + i, it[1], ix + 30, iy + 8, { size: 8 });
    });
  }

  /** Panel de la estación en modo celular: letras de 12 px, costos en una fila y botones de 44 px (el texto de arriba ya se dibujó). */
  function drawStationPanelMobile(ui, um, id, chk, c, why, x, y, w, h) {
    var run = um.run, cfg = run.data.config, base = c.combi ? c.time : c.time >= cfg.transferTime ? cfg.transferTime : cfg.stationTime, delay = c.time - base, ry = y + 82;
    ui.icon('sp:i1', 'reloj', x + 16, ry, 1.5); ui.text('sp:c1', '-' + c.time + ' min' + (delay > 2 ? ' (+' + delay + ')' : ''), x + 48, ry + 6, { size: 8, color: delay > 2 || (why && why.code === 'night') ? PAL.red : PAL.blue });
    ui.icon('sp:i2', 'rayo', x + 250, ry, 1.5); ui.text('sp:c2', '-' + c.stamina, x + 282, ry + 6, { size: 8, color: why && why.code === 'stamina' ? PAL.red : '255;255;255' });
    ui.icon('sp:i3', 'moneda', x + 340, ry, 1.5); ui.text('sp:c3', '-' + c.money, x + 372, ry + 6, { size: 8, color: why && why.code === 'money' ? PAL.red : '255;255;255' });
    if (c.combi) ui.text('sp:tr', 'COMBI', x + 450, ry + 6, { size: 8, color: '255;170;40' });
    else if (c.time >= cfg.transferTime) ui.text('sp:tr', 'TRANSBORDO', x + 450, ry + 6, { size: 8, color: PAL.yellow });
    U.Events.effects(run, c).slice(0, 2).forEach(function (e, i) { ui.text('sp:ev' + i, e, x + 440, y + h - 62 + i * 22, { size: 8, color: PAL.yellow }); });
    var label = chk.ok ? 'VIAJAR' : (REASON[chk.reason] || 'NO');
    if (ui.button('sp:go', label, x + 16, y + h - 58, 230, 44, { size: 8, fill: chk.ok ? undefined : '90;60;60' })) travel(um, id);
    if (ui.button('sp:no', 'CANCELAR', x + 258, y + h - 58, 170, 44, { size: 8, fill: '70;70;100' })) um.selected = null;
  }

  function drawStationPanel(ui, um) {
    var M = ui.mob, run = um.run, cfg = run.data.config, x = 16, y = M ? 528 : 592, w = M ? 700 : 540, h = M ? 176 : 124;
    if (um.selected) {
      var id = um.selected, st = run.data.stations[id], chk = R.canTravel(run, id), c = chk.cost || { time: 0, stamina: cfg.staminaPerStation, money: cfg.moneyPerStation };
      var desc = id === run.level.goal ? run.level.goalDesc : st.shop ? 'Hay una tienda. Monster: $' + R.monsterPrice(run) + ' (+' + cfg.monsterStamina + ' stamina)' : 'Estacion de la Linea ' + st.line + (st.colorName ? ' (' + st.colorName + ')' : '') + '. Viajar aqui?';
      if (c.combi && id !== run.level.goal) desc = 'Ruta de COMBI desde ' + run.current + ': $' + c.money + ' pero salta varias estaciones. Viajar aqui?';
      ui.rect(x, y, w, h, { fill: '12;10;24', border: PAL.orange, bw: 3, block: true });
      ui.text('sp:t', id, x + 16, y + 10, { size: 16, color: PAL.orange });
      var why = chk.ok ? null : R.explain(run, id);                          // por qué NO se puede viajar (con los números reales)
      if (why) { ui.text('sp:w1', why.short + '.', x + 16, y + 34, { size: 8, color: PAL.red }); ui.text('sp:w2', why.detail, x + 16, y + (M ? 54 : 48), { size: 8, cols: M ? 54 : 80, color: '200;205;225' }); }
      else ui.text('sp:d', desc, x + 16, y + 34, { size: 8, cols: M ? 54 : 62, color: '200;205;225' });
      if (M) return drawStationPanelMobile(ui, um, id, chk, c, why, x, y, w, h);
      var base = c.combi ? c.time : c.time >= cfg.transferTime ? cfg.transferTime : cfg.stationTime, delay = c.time - base;
      ui.icon('sp:i1', 'reloj', x + 16, y + 62, 1.5); ui.text('sp:c1', '-' + c.time + ' min' + (delay > 2 ? ' (+' + delay + ' retraso)' : '') , x + 44, y + 70, { size: 8, color: delay > 2 || (why && why.code === 'night') ? PAL.red : PAL.blue });
      ui.icon('sp:i2', 'rayo', x + 220, y + 62, 1.5); ui.text('sp:c2', '-' + c.stamina, x + 248, y + 70, { size: 8, color: why && why.code === 'stamina' ? PAL.red : '255;255;255' });
      ui.icon('sp:i3', 'moneda', x + 300, y + 62, 1.5); ui.text('sp:c3', '-' + c.money, x + 328, y + 70, { size: 8, color: why && why.code === 'money' ? PAL.red : '255;255;255' });
      if (c.combi) ui.text('sp:tr', 'COMBI', x + 400, y + 70, { size: 8, color: '255;170;40' });
      else if (c.time >= cfg.transferTime) ui.text('sp:tr', 'TRANSBORDO', x + 400, y + 70, { size: 8, color: PAL.yellow });
      var evl = U.Events.effects(run, c);                                   // eventos que encarecen este tramo (lluvia, hora pico)
      evl.slice(0, 2).forEach(function (e, i) { ui.text('sp:ev' + i, e, x + 400, y + 94 + i * 14, { size: 8, color: PAL.yellow }); });
      var label = chk.ok ? 'VIAJAR' : (REASON[chk.reason] || 'NO');
      if (ui.button('sp:go', label, x + 16, y + 90, 200, 32, { size: 8, fill: chk.ok ? undefined : '90;60;60' })) travel(um, id);   // sin poder viajar sigue siendo tocable: avisa con sonido y mensaje, no se queda mudo
      if (ui.button('sp:no', 'CANCELAR', x + 232, y + 90, 150, 32, { size: 8, fill: '70;70;100' })) um.selected = null;
    } else if (run.data.stations[run.current].shop) {
      var price = R.monsterPrice(run), can = run.money >= price && run.stamina < run.staminaMax;
      var sy = M ? 592 : 616, sh = M ? 124 : 96, bh = M ? 44 : 36, bw = M ? 330 : 300;
      ui.rect(x, sy, bw, sh, { fill: '12;10;24', border: '90;170;255', bw: 3, block: true });
      ui.icon('sh:i', 'tienda', x + 14, sy + 8, 2); ui.text('sh:t', 'TIENDA AQUI', x + 56, sy + (M ? 16 : 16), { size: 8, color: '90;170;255' });
      if (ui.button('sh:buy', 'MONSTER $' + price, x + 14, sy + sh - bh - 12, bw - 28, bh, { size: 8, fill: '39;174;96', disabled: !can })) buy(um);
    }
  }

  function drawModal(ui, um) {
    var m = um.modal; if (!m) return;
    ui.rect(0, 0, 1280, 720, { fill: '0;0;0', alpha: 150, bw: 0, modal: true, block: true });
    var M = ui.mob, w = M ? 900 : 640, lines = wrapLines(m.lines, M ? Math.floor((w - 56) / ui.fs(12)) : 48), lh = M ? 24 : 18;
    var h = M ? Math.max(300, 64 + lines.length * lh + 100) : 300, x = (1280 - w) / 2, y = Math.round((720 - h) / 2);
    ui.rect(x, y, w, h, { fill: '16;14;32', border: PAL.orange, bw: 4, modal: true, block: true });
    ui.text('md:t', m.title, x + w / 2, y + 22, { size: 16, align: 'center', color: PAL.orange, z: 320 });
    ui.lines('md:b', lines, x + 28, y + 64, { size: 12, z: 320, lineH: 18, color: '220;224;240' });
    var n = m.buttons.length, bw = M ? 220 : 170, bh = M ? 52 : 40, gap = 20, bx = x + (w - (n * bw + (n - 1) * gap)) / 2;
    m.buttons.forEach(function (b, i) {
      var fill = b.kind === 'safe' ? '39;174;96' : b.kind === 'danger' ? '192;57;43' : '70;70;100';
      if (ui.button('md:' + i, b.label, bx + i * (bw + gap), y + h - bh - 22, bw, bh, { size: 8, fill: fill, modal: true })) closeModal(um, b);
    });
  }

  // ---------------------------------------------------------------- pausa
  /** ¿Se soltó esa tecla en este fotograma? (nombres de GDevelop: 'Escape', 'p'). */
  function keyUp(scene, name) { var K = gdjs.evtTools && gdjs.evtTools.input; return !!(K && K.wasKeyReleased(scene, name)); }

  /** Pausa / continúa. Al pausar se suelta cualquier arrastre del mapa y se vuelve al menú principal de la pausa. */
  function setPause(um, on) { um.paused = on; um.pauseView = 'main'; um.drag.active = false; um.lastClick = null; um.hover = null; }

  /** Botón PAUSA en la barra de arriba, entre el reloj y el celular. */
  function drawPauseButton(ui, um) {
    if (ui.button('pa:go', 'PAUSA', 1126, 6, 86, 44, { size: 8, fill: '60;60;90' })) setPause(um, true);
  }

  /** Ventana de pausa: CONTINUAR / SONIDO (los tres volúmenes) / SALIR AL MENU (con confirmación). Todo lo de abajo queda congelado. */
  function drawPause(ui, um) {
    var run = um.run, v = um.pauseView, w = 520, x = 380, h = v === 'sound' ? (ui.mob ? 500 : 440) : v === 'a11y' ? 70 + U.A11y.height(440, ui.mob) + 10 + 44 + 40 : v === 'confirm' ? 250 : 388, y = Math.round((720 - h) / 2);
    ui.rect(0, 0, 1280, 720, { fill: '0;0;0', alpha: 170, bw: 0, modal: true, block: true });
    ui.rect(x, y, w, h, { fill: '16;14;32', border: PAL.orange, bw: 4, modal: true, block: true });
    var T = function (k, str, ty, o) { ui.text(k, str, x + w / 2, ty, Object.assign({ align: 'center', z: 330 }, o)); };
    var B = function (k, label, bx, by, bw, fill) { return ui.button(k, label, bx, by, bw, 44, { size: 8, fill: fill, modal: true }); };
    if (v === 'sound') {
      T('pa:t', 'SONIDO', y + 22, { size: 16, color: PAL.orange });
      var used = U.Audio.panel(ui, ui.scene, 'pa:', x + 40, y + 70, w - 80, false, true);
      used += U.Audio.focusRow(ui, ui.scene, 'pa:', x + 40, y + 70 + used + 2, w - 80, true) + 2;
      if (B('pa:back', 'VOLVER', x + 130, y + 70 + used + 10, 260, '70;70;100')) um.pauseView = 'main';
    } else if (v === 'a11y') {
      T('pa:t', 'ACCESIBILIDAD', y + 22, { size: 16, color: PAL.orange });
      var ah = U.A11y.panel(ui, ui.scene, 'pa:ax', x + 40, y + 70, w - 80, true);
      if (B('pa:aback', 'VOLVER', x + 130, y + 70 + ah + 10, 260, '70;70;100')) um.pauseView = 'main';
    } else if (v === 'confirm') {
      T('pa:t', 'SALIR AL MENU', y + 24, { size: 16, color: PAL.orange });
      T('pa:c1', 'Seguro que quieres salir del nivel?', y + 86, { size: 8, color: '230;234;250' });
      T('pa:c2', 'Perderas el avance de este dia.', y + 112, { size: 8, color: PAL.dim });
      if (B('pa:no', 'CANCELAR', x + 30, y + h - 70, 220, '70;70;100')) um.pauseView = 'main';
      if (B('pa:si', 'SI, SALIR', x + w - 250, y + h - 70, 220, '192;57;43')) um.exitToMenu = true;
    } else {
      T('pa:t', 'PAUSA', y + 22, { size: 24, color: PAL.orange });
      T('pa:l1', U.Infinite.title(run.level), y + 76, { size: 8, color: PAL.yellow });
      T('pa:l2', run.current + '  >  ' + run.level.goal, y + 96, { size: 8, color: PAL.dim });
      if (B('pa:cont', 'CONTINUAR', x + 110, y + 126, 300, '39;174;96')) setPause(um, false);
      if (B('pa:snd', 'SONIDO', x + 110, y + 184, 300, '60;60;90')) um.pauseView = 'sound';
      if (B('pa:a11y', 'ACCESIBILIDAD', x + 110, y + 242, 300, '60;60;90')) um.pauseView = 'a11y';
      if (B('pa:menu', 'SALIR AL MENU', x + 110, y + 300, 300, '110;50;50')) um.pauseView = 'confirm';
    }
    if (v !== 'confirm' && !ui.mob) T('pa:hint', v === 'sound' || v === 'a11y' ? 'ESC: volver' : 'ESC o P: continuar', y + h - 22, { size: 8, color: PAL.dim });
  }

  function drawFloats(ui, um, dt) {
    um.floats = um.floats.filter(function (f) { f.t += dt; return f.t < 1.8; });
    for (var i = 0; i < 4; i++) {
      var f = um.floats[i];
      if (f) ui.text('fl:' + i, f.text, 520, 76 + i * 22 - f.t * 10, { size: 8, align: 'center', color: f.color, z: 340, opacity: Math.floor(255 * Math.min(1, (1.8 - f.t) * 1.5)) });
    }
  }

  // ---------------------------------------------------------------- bucle principal
  U.Scenes.nivel = function (scene) {
    var data = U.Data.ready(scene), ui = U.UI.of(scene);
    if (!data) { ui.begin(); ui.text('load', 'CARGANDO...', 640, 340, { size: 16, align: 'center' }); ui.end(); return; }
    var um = scene._um || init(scene, data), run = um.run, rdt = Math.min(0.1, scene.getElapsedTime() / 1000), dt = um.paused ? 0 : rdt;
    ui.begin();
    if (um.geoMob !== ui.mob) { um.geoMob = ui.mob; um.map.phoneX1 = ui.mob ? 826 : 906; um.map.setPhoneOpen(um.phone.open); }   // el celular es más ancho en modo celular

    // Esc o P: pausa / continúa (en la ventana de SONIDO o de confirmación, Esc vuelve al menú de pausa); no hay pausa al terminar el día
    if (!run.over && !um.exitToMenu) {
      var esc = keyUp(scene, 'Escape'), pk = keyUp(scene, 'p');
      if (esc || pk) { if (!um.paused) { setPause(um, true); snd(um, 'click'); } else if (esc && um.pauseView !== 'main') um.pauseView = 'main'; else { setPause(um, false); snd(um, 'click'); } }
    }
    dt = um.paused ? 0 : rdt;                                   // el fotograma en que se pulsa Esc ya no avanza

    um.t = (um.t || 0) + dt; um.hurt = Math.max(0, (um.hurt || 0) - dt);
    // en pausa lo de abajo se dibuja congelado y "inerte": el cursor se esconde para que nada responda (solo la ventana de pausa)
    var cur = { x: ui.px, y: ui.py, rel: ui.released, prs: ui.pressed, whl: ui.wheel };
    if (um.paused) { ui.px = ui.py = -9999; ui.released = ui.pressed = false; ui.wheel = 0; }
    drawHUD(ui, um); drawPhoneToggle(ui, um, run); if (!run.over) drawPauseButton(ui, um); drawControls(ui, um); drawEventChips(ui, um); U.Phone.draw(ui, um, run); drawLegend(ui, um);
    if (!um.modal) drawStationPanel(ui, um);
    U.Phone.drawPush(ui, um, run, dt); drawFloats(ui, um, dt);
    if (um.paused) { ui.px = cur.x; ui.py = cur.y; ui.released = cur.rel; ui.pressed = cur.prs; ui.wheel = cur.whl; drawPause(ui, um); }
    else drawModal(ui, um);

    var busy = !!um.modal || um.map.moving() || !!um.pending || run.over || um.paused, d = um.drag, tp = ui.touch, nT = ui.touches.length;
    if (!busy && nT >= 2) {                                          // PELLIZCAR: dos dedos acercan / alejan el mapa (y lo arrastran); no cuenta como toque ni como arrastre
      var a = ui.touches[0], b = ui.touches[1], dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (!um.map.pinching()) { um.map.pinchStart(mx, my); d.pinchDist = dist; }
      um.map.pinchMove(dist / d.pinchDist, mx, my); d.active = false; um.lastClick = null; d.skipUp = true;
    } else if (um.map.pinching()) um.map.pinchEnd();
    if (!busy && nT < 2) {
      if (ui.pressed && !ui.consumed) { d.active = true; d.moved = false; d.sx = d.lx = ui.px; d.sy = d.ly = ui.py; }
      if (d.active && ui.down) {
        if (Math.hypot(ui.px - d.sx, ui.py - d.sy) > (tp ? 12 : 6)) d.moved = true;            // con el dedo hace falta mover más para que cuente como arrastre
        if (d.moved) um.map.pan(ui.px - d.lx, ui.py - d.ly);
        d.lx = ui.px; d.ly = ui.py;
      }
      if (ui.released && d.skipUp) d.skipUp = false;                                              // el dedo que queda tras pellizcar no es un toque
      else if (d.active && ui.released) {
        if (!d.moved && !ui.consumed) {
          var cid = um.map.pick(ui.px, ui.py, tp), lc = um.lastClick;
          if (cid && lc && lc.id === cid && um.t - lc.t < 0.45 && U.session.dblTravel) { um.lastClick = null; doubleClick(um, cid); }
          else { clickMap(um, cid); um.lastClick = cid ? { id: cid, t: um.t } : null; }
        }
        d.active = false;
      }
      if (ui.wheel && !ui.consumed) um.map.zoomBy(ui.wheel > 0 ? -0.1 : 0.1);
      um.hover = !ui.consumed && (!tp || ui.down) ? um.map.pick(ui.px, ui.py, tp) : null;     // con el dedo no hay "pasar por encima"
    } else { d.active = false; um.hover = null; }

    if (!um.paused && um.pending && !um.map.moving()) resolve(um);
    if (!um.paused && !um.modal && !um.pending && !um.map.moving() && !run.over) R.checkStuck(run);
    if (!um.paused && run.eventQueue && run.eventQueue.length) announceEvents(um);   // si te quedaste esperando a que reabra una línea

    um.map.update(dt, run, ui, um.hover, um.selected);
    um.fx.update(dt, um.hover, um.selected);
    U.Audio.tick(scene, 'nivel', rdt, { alert: U.Audio.danger(run), paused: um.paused });   // música del nivel, tren lejano cada 60 s y latido de apuro con < 15 % de tiempo o dinero
    ui.end();

    if (um.exitToMenu) { scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, 'Menu'); return; }
    if (run.over && !um.saved && run.level.infinite) { um.saved = true; um.streak = U.Infinite.finish(run, R.score(run).stars); }      // modo infinito: suma a la racha y guarda el récord
    else if (run.over && run.won && !um.saved) { um.saved = true; U.Save.markCompleted(run.levelIndex); um.record = U.Save.record(run.levelIndex, R.score(run).stars, run.money); }   // guarda el progreso y la mejor marca al ganar
    if (run.over && !um.achDone) { um.achDone = true; um.unlocked = U.Achievements.record(R.summary(run), um.streak ? um.streak.cleared : 0); }   // logros: suma las estadísticas y revisa todos
    if (run.over && !um.modal && !um.pending && !um.map.moving()) {
      um.endTimer += dt;
      if (um.endTimer > 0.9) { U.session.lastResult = R.summary(run); U.session.lastResult.record = um.record || null; U.session.lastResult.streak = um.streak || null; U.session.lastResult.achievements = (um.unlocked || []).map(function (a) { return a.id; }); scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, 'Resultado'); }
    }
  };
})();
