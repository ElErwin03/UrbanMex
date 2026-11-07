/* UrbanMex · escena Tutorial — cómo jugar, en 6 páginas con una demo animada cada una. Objetos: Texto, Icono, UIBase, UIModal.
 * Navegación: ANTERIOR / SIGUIENTE (o ← → Enter), puntos para saltar de página, SALTAR (o Esc). Los números salen de la configuración real del juego. */
(function () {
  var U = gdjs.UrbanMex, PAL = U.UI.PAL, util = U.util;
  U.Scenes = U.Scenes || {};
  if (U.Scenes.tutorial) return;

  var TXT_COLS = 38, TXT_LINES = 4;                                       // el texto de cada tarjeta (12 px) cabe en 4 líneas de 38 caracteres
  var DX = 660, DY = 118, DW = 540, DH = 440;                           // recuadro de la demo (a la derecha del texto)
  var DEFAULT_CFG = { currencyName: 'peje-coins', dayStartMinute: 420, dayEndMinute: 1200, stationTime: 5, transferTime: 12, staminaPerStation: 5, moneyPerStation: 5,
                      monsterPrice: 30, monsterStamina: 40, robbery: { minLoss: 20, maxLoss: 59 }, combi: { money: 10, stamina: 5 } };

  /** Las páginas (texto con los números de la configuración). Puro: lo usan la escena y las pruebas. */
  function pages(cfg) {
    cfg = cfg || DEFAULT_CFG;
    var cur = cfg.currencyName, end = util.clock(cfg.dayEndMinute), start = util.clock(cfg.dayStartMinute), urgent = Math.round(U.Rules.URGENT_BELOW * 100);
    return [
      { id: 'goal', title: 'EL OBJETIVO', items: [
        ['casa', 'SALES DE CASA', 'Cada nivel es un día de la semana. Sales de tu casa a las ' + start + '.'],
        ['meta', 'LLEGA A LA META', 'Llega a tu destino antes de las ' + end + ', con el Metro, los transbordos y las combis.'],
        ['reloj', 'EL RELOJ ES TU LIMITE', 'El tiempo solo avanza cuando viajas: ' + cfg.stationTime + ' min por estación y ' + cfg.transferTime + ' min por transbordo.']] },
      { id: 'move', title: 'COMO MOVERTE', items: [
        ['persona', 'ELIGE UNA VECINA', 'Toca una estación conectada a la tuya: las vecinas se iluminan en el mapa.'],
        ['mapa', 'PULSA VIAJAR', 'El botón está en el panel de abajo a la izquierda. Con doble clic en una vecina viajas directo.'],
        ['combi', 'COMBIS Y TRANSBORDOS', 'Las rutas punteadas naranja son combis: saltan varias estaciones y cuestan $' + cfg.combi.money + ' y ' + cfg.combi.stamina + ' de stamina. Cambiar de línea es un transbordo.']] },
      { id: 'res', title: 'TUS RECURSOS', items: [
        ['reloj', 'TIEMPO', 'Hasta las ' + end + '. Las fallas de una línea suman minutos de retraso.'],
        ['rayo', 'STAMINA', 'Cada estación gasta ' + cfg.staminaPerStation + '. En las tiendas del Metro compras un Monster: $' + cfg.monsterPrice + ' = +' + cfg.monsterStamina + ' de stamina.'],
        ['moneda', 'DINERO', 'Cada estación cuesta $' + cfg.moneyPerStation + ' ' + cur + '. Si no puedes pagar ni un tramo, se acaba el día.']] },
      { id: 'phone', title: 'EL CELULAR', items: [
        ['noticia', 'LAS NOTICIAS SON TU GUIA', 'Avisan de bloqueos, retrasos y robos antes de que te afecten. Léelas!'],
        ['mapa', 'EL MAPA NO LO DICE TODO', 'Las vías naranja-rojas tienen retraso y las moradas están bloqueadas, pero los robos solo se avisan en las noticias.'],
        ['celular', 'SE PUEDE OCULTAR', 'Con la X del celular ves todo el mapa; el icono de la esquina superior lo vuelve a abrir.']] },
      { id: 'danger', title: 'PELIGRO Y APURO', items: [
        ['alerta', 'ESTACIONES PELIGROSAS', 'Si una noticia reporta robos en una estación, pasar por ahí puede costarte de ' + cfg.robbery.minLoss + ' a ' + cfg.robbery.maxLoss + ' ' + cur + '.'],
        ['bloqueo', 'BLOQUEOS', 'Una estación bloqueada no se puede usar: busca otra ruta.'],
        ['rayo', 'APURO', 'Con menos del ' + urgent + ' % de tiempo, dinero o stamina, el borde se pone rojo y el HUD muestra "!". Si no puedes viajar, el panel te dice por qué.']] },
      { id: 'stars', title: 'ESTRELLAS Y CONTROLES', items: [
        ['estrella', 'GANA ESTRELLAS', 'Hasta tres por nivel: LLEGAR, AHORRAR dinero y SIN ASALTOS. Puedes repetir un nivel para mejorar tu marca.'],
        ['ajustes', 'PAUSA', 'Esc o P pausan el juego (también el botón PAUSA). Ahí ajustas el sonido y la accesibilidad.'],
        ['moneda', 'BUENA SUERTE!', 'Planea tu ruta, lee las noticias y cuida tus ' + cur + '.']] }
    ];
  }

  // ---- demos animadas (cada una es función pura del tiempo t; con REDUCIR MOVIMIENTO se quedan fijas)
  function frame(ui) { ui.rect(DX, DY, DW, DH, { fill: '18;18;36', border: '60;60;90', bw: 3 }); }
  function node(ui, x, y, fill) { ui.rect(x - 9, y - 9, 18, 18, { fill: fill || '70;90;200', border: '255;255;255', bw: 2 }); }
  function ring(ui, x, y, color, on) { if (on) ui.rect(x - 16, y - 16, 32, 32, { fill: '18;18;36', border: color, bw: 3 }); }
  function along(pts, p) {                                               // punto a la fracción p (0..1) de la poligonal
    var seg = pts.length - 1, f = util.clamp(p, 0, 0.9999) * seg, i = Math.floor(f), k = f - i;
    return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k };
  }
  function poly(ui, pts, th, color) { for (var i = 0; i < pts.length - 1; i++) ui.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], th, color); }

  var DEMO = {
    goal: function (ui, t, calm, cfg) {
      var pts = [[720, 330], [790, 270], [870, 330], [950, 270], [1030, 330], [1100, 270], [1150, 330]], p = calm ? 0.45 : (t * 0.12) % 1;
      poly(ui, pts, 4, '90;110;220');
      for (var i = 1; i < pts.length - 1; i++) node(ui, pts[i][0], pts[i][1]);
      ui.icon('dg0', 'casa', pts[0][0] - 16, pts[0][1] - 16, 2); ui.icon('dg1', 'meta', pts[6][0] - 16, pts[6][1] - 16, 2);
      ui.text('dgl0', 'TU CASA', pts[0][0], pts[0][1] + 24, { size: 8, align: 'center', color: PAL.dim }); ui.text('dgl1', 'META', pts[6][0] - 6, pts[6][1] + 24, { size: 8, align: 'center', color: PAL.green });
      var me = along(pts, p); ui.icon('dgp', 'persona', me.x - 16, me.y - 46 + (calm ? 0 : Math.round(Math.sin(t * 6) * 2)), 2);
      var min = cfg.dayStartMinute + Math.round(p * 120);
      ui.text('dgt', 'HORA LIMITE: ' + util.clock(cfg.dayEndMinute), 930, 420, { size: 8, align: 'center', color: PAL.yellow });
      ui.bar(720, 442, 420, 22, (min - cfg.dayStartMinute) / (cfg.dayEndMinute - cfg.dayStartMinute), '245;197;66');
      ui.text('dgc', 'AHORA: ' + util.clock(min), 930, 482, { size: 12, align: 'center' });
      ui.text('dgn', 'Con una buena ruta te sobra tiempo.', 930, 520, { size: 8, align: 'center', color: PAL.dim });
    },
    move: function (ui, t, calm) {
      var A = [730, 340], B = [860, 260], C = [860, 420], D = [990, 260], E = [990, 420], F = [1110, 340];
      var ph = calm ? 2.0 : t % 5, selB = ph > 0.6 && ph < 3.3, press = ph > 1.8 && ph < 2.6, walk = ph >= 2.6 ? util.clamp((ph - 2.6) / 1.2, 0, 1) : 0;
      [[A, B], [A, C], [B, D], [C, E], [D, F], [E, F]].forEach(function (e) { ui.line(e[0][0], e[0][1], e[1][0], e[1][1], 4, '70;80;150'); });
      var pulse = calm || Math.floor(t * 4) % 2 === 0;
      ring(ui, B[0], B[1], PAL.yellow, pulse && !selB); ring(ui, C[0], C[1], PAL.yellow, pulse && !selB);   // las vecinas se iluminan
      ring(ui, B[0], B[1], PAL.green, selB);
      node(ui, B[0], B[1]); node(ui, C[0], C[1]); node(ui, D[0], D[1], '50;56;100'); node(ui, E[0], E[1], '50;56;100'); node(ui, F[0], F[1], '50;56;100');
      var me = { x: A[0] + (B[0] - A[0]) * walk, y: A[1] + (B[1] - A[1]) * walk }; node(ui, A[0], A[1], '50;56;100'); ui.icon('dmp', 'persona', me.x - 16, me.y - 46, 2);
      ui.text('dm0', 'TU', A[0], A[1] + 20, { size: 8, align: 'center', color: PAL.dim }); ui.text('dm1', 'VECINA', B[0], B[1] - 36, { size: 8, align: 'center', color: PAL.yellow }); ui.text('dm2', 'VECINA', C[0], C[1] + 22, { size: 8, align: 'center', color: PAL.yellow });
      ui.text('dm3', 'LEJOS: aún no', E[0] + 20, E[1] + 22, { size: 8, align: 'center', color: '110;116;150' });
      ui.rect(720, 480, 420, 52, { fill: '26;26;46', border: '60;60;90', bw: 2 });                                // el panel de la estación (maqueta)
      ui.rect(740, 490, 170, 32, { fill: press ? '70;200;120' : selB ? '39;174;96' : '60;60;80', border: '255;255;255', bw: 2 });
      ui.text('dm4', 'VIAJAR', 825, 502, { size: 8, align: 'center', color: selB ? '255;255;255' : '130;130;150' });
      ui.text('dm5', selB ? '1) toca  2) VIAJAR' : '1) toca una vecina', 925, 500, { size: 8, color: PAL.dim });
      ui.text('dm6', walk > 0 ? 'Llegaste!' : '', 925, 514, { size: 8, color: PAL.green });
    },
    res: function (ui, t, calm, cfg) {
      var ph = calm ? 0.8 : (t % 9) / 9, left = 1 - ph * 0.93;                                   // se gastan al viajar: de 100 % a 7 %
      var rows = [['reloj', 'TIEMPO', '245;197;66', left], ['rayo', 'STAMINA', '241;196;15', Math.max(0.02, left - 0.04)], ['moneda', 'DINERO', '46;204;113', Math.max(0.02, left + 0.02)]];
      var low = left < U.Rules.URGENT_BELOW + 0.04;
      rows.forEach(function (r, i) {
        var y = 160 + i * 92, urgent = r[3] < U.Rules.URGENT_BELOW;
        ui.icon('dr' + i, r[0], 700, y, 2); ui.text('drl' + i, r[1], 750, y + 4, { size: 8, color: PAL.dim });
        ui.bar(750, y + 22, 340, 22, r[3], urgent ? '231;76;60' : r[2]);
        ui.text('drv' + i, Math.round(r[3] * 100) + ' %', 1100, y + 27, { size: 8, color: urgent ? PAL.red : '255;255;255' });
        if (urgent) ui.text('drw' + i, '!', 1160, y + 14, { size: 16, color: PAL.red });
      });
      ui.rect(700, 444, 460, 86, { fill: '26;26;46', border: low ? '231;76;60' : '60;60;90', bw: 2 });
      ui.lines('drn', util.wrap(low ? 'Rojo y "!": ya casi se acaba. Piensa si te alcanza para llegar.' : 'Cada estación que recorres gasta tiempo, stamina y dinero.', 44), 720, 460, { size: 8, lineH: 14, color: low ? PAL.red : PAL.dim });
      ui.text('drm', 'Meta: llegar antes de que se acabe alguno.', 720, 504, { size: 8, color: PAL.dim });
    },
    phone: function (ui, t, calm) {
      var apps = [['news', 'noticia', 'NOTICIAS', '120;40;40', 'Avisos de robos, bloqueos y retrasos.'], ['map', 'mapa', 'RUTA', '30;70;110', 'Tu origen, meta y tiempo libre.'],
                  ['saldo', 'saldo', 'SALDO', '30;90;60', 'Cuánto dinero llevas y cuánto gastas.'], ['lines', 'lineas', 'LINEAS', '90;50;110', 'Colores de las líneas y cómo leer las noticias.'],
                  ['snd', 'sonido', 'SONIDO', '30;80;100', 'Volumen de música y sonidos.'], ['config', 'ajustes', 'AJUSTES', '70;70;90', 'Doble clic, accesibilidad y salir.']];
      var cur = calm ? 0 : Math.floor(t / 2.2) % apps.length, X = 820, Y = 134, W = 300, H = 330;
      ui.rect(X, Y, W, H, { fill: '8;8;14', border: '70;70;95', bw: 4 });
      ui.text('dpt', 'MI CELULAR', X + W / 2, Y + 14, { size: 8, align: 'center', color: PAL.dim });
      apps.forEach(function (a, i) {
        var x = X + 14 + (i % 2) * 140, y = Y + 40 + Math.floor(i / 2) * 94, on = i === cur;
        ui.rect(x, y, 130, 84, { fill: a[3], border: on ? '255;235;120' : '255;255;255', bw: on ? 4 : 2 });
        ui.icon('dpi' + i, a[1], x + 49, y + 10, 2); ui.text('dpl' + i, a[2], x + 65, y + 58, { size: 8, align: 'center' });
      });
      ui.text('dpa', apps[cur][2], 930, 484, { size: 12, align: 'center', color: PAL.yellow });
      ui.lines('dpd', util.wrap(apps[cur][4], 46), 930, 506, { size: 8, lineH: 14, align: 'center', color: '210;214;232' });
    },
    danger: function (ui, t, calm) {
      var A = [730, 400], X = [930, 400], B = [1130, 400], Y1 = [830, 470], Y2 = [1030, 470], pulse = calm || Math.floor(t * 3) % 2 === 0;
      ui.rect(700, 140, 460, 120, { fill: '48;30;30', border: '231;76;60', bw: 3 });                              // noticia de ejemplo
      ui.icon('dn0', 'alerta', 716, 156, 2); ui.text('dn1', '10:25  PELIGRO', 764, 160, { size: 8, color: PAL.red });
      ui.lines('dn2', util.wrap('Reportan robos en esta estación. Evítala o arriesgas tus monedas.', 42), 716, 196, { size: 8, lineH: 14 });
      ui.line(A[0], A[1], X[0], X[1], 4, '231;76;60'); ui.line(X[0], X[1], B[0], B[1], 4, '231;76;60');       // atajo peligroso
      poly(ui, [A, Y1, Y2, B], 4, '46;204;113');                                                                  // rodeo seguro
      ring(ui, X[0], X[1], PAL.red, pulse); node(ui, A[0], A[1], '50;56;100'); node(ui, B[0], B[1], '50;56;100'); node(ui, Y1[0], Y1[1]); node(ui, Y2[0], Y2[1]); node(ui, X[0], X[1], '200;60;50');
      ui.icon('dn3', 'alerta', X[0] - 16, X[1] - 52, 2);
      ui.text('dn4', 'ATAJO PELIGROSO', X[0], X[1] - 66 + 0, { size: 8, align: 'center', color: PAL.red }); ui.text('dn5', 'RODEO SEGURO', 930, 496, { size: 8, align: 'center', color: PAL.green });
      ui.text('dn6', 'Salida', A[0], A[1] - 28, { size: 8, align: 'center', color: PAL.dim }); ui.text('dn7', 'Meta', B[0], B[1] - 28, { size: 8, align: 'center', color: PAL.dim });
      ui.text('dn8', 'Más largo, pero sin asaltos.', 930, 524, { size: 8, align: 'center', color: PAL.dim });
    },
    stars: function (ui, t, calm) {
      var names = ['LLEGAR', 'AHORRAR', 'SIN ASALTOS'], hints = ['a la meta', 'con dinero', 'ni un robo'];
      for (var i = 0; i < 3; i++) {
        var cx = 930 + (i - 1) * 160, on = calm || (t % 4) > 0.4 + i * 0.5, s = on && !calm && (t % 4) < 0.8 + i * 0.5 ? 6 : 5, px = 16 * s;
        ui.icon('ds' + i, on ? 'estrella' : 'estrella_vacia', cx - px / 2, 150 + (80 - px) / 2, s);
        ui.text('dsl' + i, names[i], cx, 244, { size: 8, align: 'center', color: PAL.yellow }); ui.text('dsh' + i, hints[i], cx, 262, { size: 8, align: 'center', color: PAL.dim });
      }
      var keys = [['ESC', 'PAUSA'], ['P', 'PAUSA'], ['2 CLICS', 'VIAJAR']];
      keys.forEach(function (k, i) {
        var x = 720 + i * 150, w = i === 2 ? 130 : 110;
        ui.rect(x, 330, w, 56, { fill: '38;38;66', border: '255;255;255', bw: 3 }); ui.text('dk' + i, k[0], x + w / 2, 352, { size: 12, align: 'center' });
        ui.text('dkl' + i, k[1], x + w / 2, 400, { size: 8, align: 'center', color: PAL.dim });
      });
      ui.rect(720, 450, 420, 80, { fill: '26;26;46', border: '60;60;90', bw: 2 });
      ui.lines('dsn', util.wrap('Desde el menú y la pausa, ACCESIBILIDAD cambia los efectos y reduce el movimiento.', 44), 740, 466, { size: 8, lineH: 14, color: '210;214;232' });
    }
  };

  /** Siguiente / anterior (puros, sin pasarse de los extremos). */
  var Nav = { next: function (i, n) { return Math.min(n - 1, i + 1); }, prev: function (i) { return Math.max(0, i - 1); } };
  function key(scene, name) { var K = gdjs.evtTools && gdjs.evtTools.input; return !!(K && K.wasKeyReleased(scene, name)); }

  U.Scenes.tutorial = function (scene) {
    var ui = U.UI.of(scene), data = U.Data.ready(scene), cfg = data ? data.config : DEFAULT_CFG, list = pages(cfg), n = list.length;
    ui.begin();
    var dt = Math.min(0.1, scene.getElapsedTime() / 1000), t = scene._umT = (scene._umT || 0) + dt, st = scene._umTut = scene._umTut || { page: 0 };
    (scene._umFx || (scene._umFx = U.FX.ambient(scene, 'neutral'))).update(dt);   // viñeta, bruma y polvo suaves
    U.Audio.tick(scene, 'menu', dt);
    var finish = function () {                                                      // desde COMO JUGAR vuelve al menú; desde JUGAR sigue al nivel elegido
      U.session.seenTutorial = true; U.Save.persist();
      scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, U.session.afterTutorial || 'Nivel');
    };
    var last = st.page === n - 1;
    if (key(scene, 'Right') || key(scene, 'Return') || key(scene, 'Space')) { if (last) { finish(); ui.end(); return; } st.page = Nav.next(st.page, n); last = st.page === n - 1; }
    if (key(scene, 'Left')) { st.page = Nav.prev(st.page); last = false; }
    if (key(scene, 'Escape')) { finish(); ui.end(); return; }
    var pg = list[st.page], calm = U.A11y.calm();

    ui.text('h', 'COMO JUGAR  ' + (st.page + 1) + '/' + n, 640, 24, { size: 8, align: 'center', color: PAL.dim });
    ui.text('t', pg.title, 640, 54, { size: 24, align: 'center', color: PAL.yellow });
    pg.items.forEach(function (it, i) {                                             // texto a la izquierda: icono, título y explicación
      var y = DY + 8 + i * 140;
      ui.rect(70, y, 560, 128, { fill: '24;24;46', border: '60;60;90', bw: 2 });
      ui.icon('ic' + i, it[0], 86, y + 14, 3);
      ui.text('lb' + i, it[1], 148, y + 16, { size: 12, color: PAL.orange });
      ui.lines('tx' + i, util.wrap(it[2], TXT_COLS), 148, y + 42, { size: 12, lineH: 18, color: '210;214;232' });
    });
    frame(ui); DEMO[pg.id](ui, t, calm, cfg);

    for (var d = 0; d < n; d++) {                                                   // puntos de página (se pueden pulsar)
      var dx = 640 - (n * 28 - 10) / 2 + d * 28;
      ui.rect(dx, 584, 18, 18, { fill: d === st.page ? '245;197;66' : '40;40;70', border: '255;255;255', bw: 2 });
      if (ui.inside(dx, 584, 18, 18) && ui.released) st.page = d;
    }
    if (st.page > 0 && ui.button('prev', '< ANTERIOR', 70, 624, 200, 52, { size: 8, fill: '70;70;100' })) st.page = Nav.prev(st.page);
    if (!last && ui.button('skip', 'SALTAR', 1060, 16, 150, 34, { size: 8, fill: '70;70;100' })) { finish(); ui.end(); return; }
    if (ui.button('ok', last ? (U.session.afterTutorial === 'Menu' ? 'ENTENDIDO!' : 'A JUGAR!') : 'SIGUIENTE >', 440, 624, 400, 52, { size: 16, fill: '39;174;96' })) {
      if (last) { finish(); ui.end(); return; }
      st.page = Nav.next(st.page, n);
    }
    ui.end();
  };
  U.TutorialPages = pages; U.TutorialLayout = { cols: TXT_COLS, lines: TXT_LINES };
})();
