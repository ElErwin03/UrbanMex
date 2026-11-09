/* UrbanMex · phone — el celular del jugador (única guía del juego): Noticias, Ruta, Saldo, Líneas y Ajustes.
 * Se puede ocultar (botón X) y volver a abrir con el icono de la esquina superior derecha. Los avisos de noticias
 * aparecen como notificación DENTRO del celular. Se dibuja con la UI de modo inmediato en la capa "UI". */
(function () {
  var U = gdjs.UrbanMex, util = U.util, PAL = U.UI.PAL;
  if (U.Phone) return;

  // Geometría del celular: en modo celular (interfaz grande, ver mobile.js) es más ancho y los botones miden 44 px o más.
  var X = 920, Y = 64, W = 340, H = 560, G = { X: X, Y: Y, W: W, H: H, head: 34, foot: 52, mob: false };
  function geo(ui) { return ui.mob ? { X: 840, Y: 64, W: 420, H: 560, head: 48, foot: 60, mob: true } : { X: X, Y: Y, W: W, H: H, head: 34, foot: 52, mob: false }; }
  var SEV = { danger: PAL.red, warning: PAL.yellow, success: PAL.green, info: PAL.blue };
  var APPS = [
    { id: 'news', label: 'NOTICIAS', icon: 'noticia', fill: '120;40;40' },
    { id: 'map', label: 'RUTA', icon: 'mapa', fill: '30;70;110' },
    { id: 'saldo', label: 'SALDO', icon: 'saldo', fill: '30;90;60' },
    { id: 'lines', label: 'LINEAS', icon: 'lineas', fill: '90;50;110' },
    { id: 'snd', label: 'SONIDO', icon: 'sonido', fill: '30;80;100' },
    { id: 'config', label: 'AJUSTES', icon: 'ajustes', fill: '70;70;90' },
    { id: 'a11y', label: 'ACCESIBILIDAD', icon: 'ajustes', fill: '70;70;90', hidden: true }   // se entra desde AJUSTES (no cabe en la rejilla)
  ];

  /** Cuadritos con el color y la letra/número de cada línea afectada, alineados a la derecha en rx. */
  function chips(ui, key, lines, rx, y, run, modal) {
    var cw = ui.mob ? 26 : 18, ch = ui.mob ? 20 : 16, step = cw + 4;
    (lines || []).forEach(function (l, k) {
      var x0 = rx - (k + 1) * step + 4, ln = run.data.lines[l]; if (!ln) return;
      ui.rect(x0, y, cw, ch, { fill: util.hex(ln.color), border: '255;255;255', bw: 1, modal: modal });
      ui.text(key + k, l, x0 + cw / 2, y + (ch - ui.fs(8)) / 2, { size: 8, align: 'center', color: '16;14;30', z: modal ? 335 : 205 });
    });
  }

  /** Tarjetas de noticia: la letra es de 12 px (16 en modo celular); `cols` = letras por línea según el ancho disponible. */
  function cardLines(n, cols) {
    return { t: util.wrap(n.title, cols), d: util.wrap(n.desc, cols), i: util.wrap(n.impact, cols) };
  }
  function cols(ui, w, size) { return Math.max(10, Math.floor(w / ui.fs(size)) - 1); }

  var Phone = {
    rect: { x: X, y: Y, w: W, h: H },
    newPhoneState: function () { return { app: 'home', scroll: 0, open: true }; },

    draw: function (ui, um, run) {
      var g = G = geo(ui), M = g.mob, ph = um.phone, sx = g.X + 10, sy = g.Y + g.head, sw = g.W - 20, bodyH = g.H - g.head - g.foot;
      if (!ph.open) return;
      if (ph.app !== 'lines' && um.map.highlight) um.map.highlight = null;       // al salir de LINEAS el mapa vuelve a la normalidad
      ui.rect(g.X, g.Y, g.W, g.H, { fill: '8;8;14', border: '70;70;95', bw: 4, block: true });
      ui.rect(sx, sy, sw, bodyH, { fill: '12;12;30', border: '30;30;55', bw: 2, block: true });
      ui.text('ph:clk', util.clock(run.minute), g.X + 18, g.Y + (M ? 18 : 12), { size: 8 });
      ui.text('ph:net', 'LTE', g.X + g.W - (M ? 74 : 46), g.Y + (M ? 18 : 12), { size: 8, align: 'right', color: PAL.dim });
      if (M ? ui.button('ph:hide', 'X', g.X + g.W - 62, g.Y + 2, 52, 44, { fill: '150;50;50', size: 8 }) : ui.button('ph:hide', 'X', g.X + g.W - 34, g.Y + 6, 26, 22, { fill: '150;50;50', size: 8 })) um.setPhone(false);   // ocultar el celular
      var top = sy + 10;

      if (ph.app === 'home') {
        ui.text('ph:h', 'MI CELULAR', g.X + g.W / 2, top, { size: 8, align: 'center', color: PAL.dim });
        var tw = M ? 194 : 150, tg = M ? 8 : 8;
        APPS.filter(function (a) { return !a.hidden; }).forEach(function (a, i) {
          var ax = sx + 8 + (i % 2) * (tw + tg), ay = top + (M ? 32 : 28) + Math.floor(i / 2) * 124;
          ui.rect(ax, ay, tw, 112, { fill: a.fill, border: '255;255;255', bw: 2, block: true });
          ui.icon('ph:ai' + a.id, a.icon, ax + tw / 2 - 24, ay + 16, 3);
          ui.text('ph:al' + a.id, a.label, ax + tw / 2, ay + (M ? 80 : 82), { size: 8, align: 'center' });
          if (a.id === 'news' && run.unread > 0) {
            ui.rect(ax + tw - 26, ay + 4, 22, M ? 24 : 18, { fill: PAL.red, border: '255;255;255', bw: 2 });
            ui.text('ph:badge', String(Math.min(run.unread, 99)), ax + tw - 15, ay + (M ? 8 : 9), { size: 8, align: 'center' });
          }
          if (ui.inside(ax, ay, tw, 112) && ui.released) { ph.app = a.id; ph.scroll = 0; if (a.id === 'news') run.unread = 0; }
        });
      } else {
        var app = APPS.filter(function (a) { return a.id === ph.app; })[0];
        var hh = M ? 50 : 32;
        ui.rect(sx, sy, sw, hh, { fill: app.fill, border: '255;255;255', bw: 2 });
        ui.icon('ph:hi', app.icon, sx + 8, sy + (M ? 17 : 8), 1);
        ui.text('ph:ht', app.label, sx + 34, sy + (M ? 19 : 12), { size: 8 });
        if (M ? ui.button('ph:back', '<', sx + sw - 54, sy + 3, 48, 44, { fill: '60;60;90', size: 8 }) : ui.button('ph:back', '<', sx + sw - 34, sy + 4, 28, 24, { fill: '60;60;90', size: 8 })) ph.app = 'home';
        if (ph.app !== 'home') Phone['_' + ph.app](ui, um, run, sx + 8, sy + hh + 10, sw - 16, bodyH - hh - 18);   // (si se acaba de pulsar <, ya no hay app que dibujar)
      }
      if (M ? ui.button('ph:homebtn', 'INICIO', g.X + g.W / 2 - 70, g.Y + g.H - 54, 140, 44, { fill: '60;60;90', size: 8 }) : ui.button('ph:homebtn', 'INICIO', g.X + g.W / 2 - 46, g.Y + g.H - 40, 92, 26, { fill: '60;60;90', size: 8 })) ph.app = 'home';
    },

    _news: function (ui, um, run, x, y, w, h) {
      var g = G, M = g.mob, lh = M ? 21 : 16, nc = cols(ui, w - 16, 12), log = run.newsLog, ph = um.phone, maxScroll = Math.max(0, log.length - 1);
      run.unread = 0;                                                            // estás leyendo: nada sin leer
      if (ui.inside(g.X, g.Y, g.W, g.H) && ui.wheel) ph.scroll = util.clamp(ph.scroll + (ui.wheel > 0 ? 1 : -1), 0, maxScroll);
      ph.scroll = util.clamp(ph.scroll, 0, maxScroll);
      if (!log.length) { ui.text('ph:ne', 'Sin noticias aun', x + w / 2, y + 40, { size: 8, align: 'center', color: PAL.dim }); return; }
      var cy = y, shown = 0;
      for (var i = ph.scroll; i < log.length; i++) {
        var n = log[i], L = cardLines(n, nc), ch = (M ? 34 : 22) + (L.t.length + L.d.length + L.i.length) * lh + 12;
        if (cy + ch > y + h - (M ? 54 : 30) && shown > 0) break;
        var col = SEV[n.severity] || PAL.blue;
        ui.rect(x, cy, w, ch, { fill: '24;24;46', border: col, bw: 2 });
        ui.text('ph:n' + shown + 'h', n.time + '  ' + n.type.toUpperCase(), x + 8, cy + 8, { size: 8, color: PAL.dim });
        chips(ui, 'ph:n' + shown + 'c', n.lines, x + w - 6, cy + 5, run, false);
        var ty = cy + (M ? 32 : 24), k = 'ph:n' + shown;
        ty += ui.lines(k + 't', L.t, x + 8, ty, { size: 12, lineH: 16 });
        ty += ui.lines(k + 'd', L.d, x + 8, ty, { size: 12, color: '170;176;204', lineH: 16 });
        ui.lines(k + 'i', L.i, x + 8, ty, { size: 12, color: PAL.orange, lineH: 16 });
        cy += ch + 6; shown++;
      }
      if (M) {
        ui.text('ph:npos', (ph.scroll + 1) + '/' + log.length, x + 4, y + h - 32, { size: 8, color: PAL.dim });
        if (ui.button('ph:up', '^', x + w - 100, y + h - 48, 48, 44, { fill: '60;60;90' })) ph.scroll = Math.max(0, ph.scroll - 1);
        if (ui.button('ph:dn', 'v', x + w - 48, y + h - 48, 48, 44, { fill: '60;60;90' })) ph.scroll = Math.min(maxScroll, ph.scroll + 1);
        return;
      }
      ui.text('ph:npos', (ph.scroll + 1) + '/' + log.length + ' (rueda del raton)', x + w / 2, y + h - 14, { size: 8, align: 'center', color: PAL.dim });
      if (ui.button('ph:up', '^', x + w - 62, y + h - 22, 28, 20, { fill: '60;60;90' })) ph.scroll = Math.max(0, ph.scroll - 1);
      if (ui.button('ph:dn', 'v', x + w - 30, y + h - 22, 28, 20, { fill: '60;60;90' })) ph.scroll = Math.min(maxScroll, ph.scroll + 1);
    },

    _map: function (ui, um, run, x, y, w) {
      var lv = run.level, cfg = run.data.config, left = cfg.dayEndMinute - run.minute;
      var rows = [['ORIGEN', lv.start], ['META', lv.goal], ['ESTAS EN', run.current], ['HORA LIMITE', util.clock(cfg.dayEndMinute)],
                  ['TIEMPO LIBRE', util.duration(left)], ['ESTACIONES', String(run.steps)]];
      var cy = y, lh = ui.mob ? 18 : 12, lab = ui.mob ? 18 : 14;
      rows.forEach(function (r, i) {
        var vl = util.wrap(r[1], ui.mob ? 31 : 32);
        ui.text('ph:mr' + i, r[0], x, cy, { size: 8, color: PAL.blue });
        ui.lines('ph:mv' + i, vl, x, cy + lab, { size: 8, lineH: 12 });
        cy += lab + vl.length * lh + (ui.mob ? 10 : 8);
      });
      ui.lines('ph:mtip', util.wrap('Las vias naranja-rojas del mapa tienen retraso. Las moradas estan bloqueadas.', 31), x, cy + 6, { size: 8, color: PAL.yellow, lineH: 12 });
    },

    /** Qué color es cada línea; tocar una la resalta en el mapa. También explica bloqueo / peligro / retraso. */
    _lines: function (ui, um, run, x, y, w) {
      var ids = Object.keys(run.data.lines), count = {}, hl = um.map.highlight;
      run.data.stationList.forEach(function (st) { count[st.line] = (count[st.line] || 0) + 1; });
      var M = ui.mob, rh = M ? 48 : 34, step = M ? 54 : 40;
      ids.forEach(function (id, i) {
        var ln = run.data.lines[id], ry = y + i * step, on = hl === id;
        ui.rect(x, ry, w, rh, { fill: on ? '44;44;80' : '24;24;46', border: on ? '255;255;255' : '60;60;90', bw: 2, block: true });
        ui.rect(x + 6, ry + (M ? 8 : 5), M ? 32 : 24, M ? 32 : 24, { fill: util.hex(ln.color), border: '255;255;255', bw: 2 });
        ui.text('ph:lk' + i, id, x + (M ? 22 : 18), ry + (M ? 16 : 13), { size: 8, align: 'center', color: '16;14;30' });
        ui.text('ph:ln' + i, ln.name.toUpperCase(), x + (M ? 48 : 40), ry + (M ? 6 : 4), { size: 12 });
        ui.text('ph:lc' + i, (ln.colorName || '').toUpperCase(), x + (M ? 48 : 40), ry + (M ? 28 : 21), { size: 8, color: util.hex(ln.color) });
        ui.text('ph:ls' + i, (count[id] || 0) + ' est.', x + w - 8, ry + (M ? 16 : 13), { size: 8, align: 'right', color: PAL.dim });
        if (ui.inside(x, ry, w, rh) && ui.released) um.map.highlight = on ? null : id;
      });
      var cy = y + ids.length * step + 2;
      cy += ui.lines('ph:lh', util.wrap('Toca una linea para verla en el mapa.', 31), x, cy, { size: 8, color: PAL.yellow, lineH: 12 }) + 8;
      if (M) return;                                                              // (en modo celular no cabe: el tutorial explica cómo leer las noticias)
      ui.text('ph:lg', 'COMO LEER LAS NOTICIAS', x, cy, { size: 8, color: PAL.orange }); cy += 18;
      [['BLOQUEO: solo se cierra esa estacion, no toda la linea. Busca otra ruta.', PAL.purple],
       ['PELIGRO: puede haber asaltos en esa estacion.', PAL.red],
       ['RETRASO: viajar por esa linea tarda mas minutos.', PAL.yellow],
       ['COMBI: ruta punteada naranja entre estaciones separadas. Cuesta $' + run.data.config.combi.money + ' y salta varias.', '255;170;40'],
       ['Via naranja-roja = retraso. Via morada = bloqueada.', PAL.dim]].forEach(function (g, i) {
        var l = util.wrap(g[0], 31);
        cy += ui.lines('ph:lt' + i, l, x, cy, { size: 8, lineH: 12, color: g[1] }) + 5;
      });
    },

    _saldo: function (ui, um, run, x, y, w) {
      var cfg = run.data.config, price = U.Rules.monsterPrice(run);
      ui.text('ph:sl', 'MI BILLETERA', x + w / 2, y, { size: 8, align: 'center', color: PAL.dim });
      ui.icon('ph:sc', 'moneda', x + w / 2 - 80, y + 28, 3);
      ui.text('ph:sm', String(run.money), x + w / 2 - 24, y + 40, { size: 16, color: PAL.green });
      ui.text('ph:sn', cfg.currencyName, x + w / 2, y + 82, { size: 8, align: 'center', color: PAL.dim });
      var rows = [['STAMINA', Math.floor(run.stamina) + '/' + run.staminaMax], ['MONSTER', price + (run.monsterPromo ? ' (2x1!)' : '')],
                  ['PASAJE', (run.freeRides > 0 ? 'GRATIS' : cfg.moneyPerStation) + ' x estacion'], ['ASALTOS', String(run.robbed)]];
      var M = ui.mob, rh = M ? 38 : 28, step = M ? 46 : 34, ty = M ? 13 : 10;
      rows.forEach(function (r, i) {
        ui.rect(x, y + 108 + i * step, w, rh, { fill: '24;24;46', border: '60;60;90', bw: 2 });
        ui.text('ph:sr' + i, r[0], x + 8, y + 108 + i * step + ty, { size: 8, color: PAL.dim });
        ui.text('ph:sv' + i, r[1], x + w - 8, y + 108 + i * step + ty, { size: 8, align: 'right' });
      });
    },

    _snd: function (ui, um, run, x, y, w) {
      var h = U.Audio.panel(ui, um.ui.scene, 'ph:', x, y + 4, w, true);
      h += U.Audio.focusRow(ui, um.ui.scene, 'ph:', x, y + 4 + h + 2, w) + 2;
      if (!ui.mob) ui.lines('ph:sn', util.wrap('El apuro suena cuando te queda menos del 15% del tiempo, dinero o energia.', 31), x, y + h + 10, { size: 8, lineH: 12, color: PAL.dim });
    },

    _a11y: function (ui, um, run, x, y, w) { U.A11y.panel(ui, um.ui.scene, 'ph:ax', x, y + 4, w); },

    _config: function (ui, um, run, x, y, w) {
      var M = ui.mob, rows = [['DIA', run.level.day], [run.level.infinite ? 'RONDA' : 'NIVEL', run.level.infinite ? String(run.level.round) : run.level.id + '/' + run.data.levels.length], ['PASOS', String(run.steps)],
                  ['NOTICIAS', String(run.newsCount)], ['VERSION', U.VERSION]], rs = M ? 28 : 24;
      rows.forEach(function (r, i) {
        ui.text('ph:cr' + i, r[0], x, y + i * rs, { size: 8, color: PAL.dim });
        ui.text('ph:cv' + i, r[1], x + w, y + i * rs, { size: 8, align: 'right' });
      });
      var dbl = U.session.dblTravel !== false, by = y + (M ? 150 : 128);            // doble clic (o doble toque) en una estación = viajar solo hasta ahí
      if (M) {
        if (ui.button('ph:dbl', 'DOBLE TOQUE: ' + (dbl ? 'SI' : 'NO'), x, by, w, 44, { size: 8, fill: dbl ? '39;174;96' : '110;60;60' })) { U.session.dblTravel = !dbl; U.Save.persist(); }
        if (ui.button('ph:snd', 'SONIDO Y MUSICA >', x, by + 52, w, 44, { size: 8, fill: '30;80;100' })) { um.phone.app = 'snd'; um.phone.scroll = 0; }
        if (ui.button('ph:a11y', 'ACCESIBILIDAD >', x, by + 104, w, 44, { size: 8, fill: '30;80;100' })) { um.phone.app = 'a11y'; um.phone.scroll = 0; }
        if (ui.button('ph:menu', 'SALIR AL MENU', x, by + 156, w, 44, { size: 8, fill: '150;50;50' })) um.exitToMenu = true;
        return;
      }
      if (ui.button('ph:dbl', 'DOBLE CLIC VIAJAR: ' + (dbl ? 'SI' : 'NO'), x, y + 128, w, 30, { size: 8, fill: dbl ? '39;174;96' : '110;60;60' })) { U.session.dblTravel = !dbl; U.Save.persist(); }
      ui.lines('ph:dbh', util.wrap('Doble clic en una estacion vecina (la siguiente a la tuya): viajas ahi sin confirmar.', 31), x, y + 166, { size: 8, lineH: 12, color: PAL.dim });
      if (ui.button('ph:snd', 'SONIDO Y MUSICA >', x, y + 232, w, 30, { size: 8, fill: '30;80;100' })) { um.phone.app = 'snd'; um.phone.scroll = 0; }   // volumen y silencio de música, sonidos y peligro
      ui.lines('ph:sdh', util.wrap('Musica relajante de fondo y un tren lejano que pasa cada minuto, a volumen bajo.', 31), x, y + 270, { size: 8, lineH: 12, color: PAL.dim });
      if (ui.button('ph:a11y', 'ACCESIBILIDAD >', x, y + 312, w, 30, { size: 8, fill: '30;80;100' })) { um.phone.app = 'a11y'; um.phone.scroll = 0; }   // efectos y reducir movimiento
      if (ui.button('ph:menu', 'SALIR AL MENU', x, y + 354, w, 28, { fill: '150;50;50' })) um.exitToMenu = true;
    }
  };

  /** Aviso de noticia como notificación del propio celular (arriba de su pantalla). Tocarlo abre Noticias. */
  Phone.drawPush = function (ui, um, run, dt) {
    var p = um.push; if (!p) return;
    if (!um.phone.open) { um.push = null; return; }
    p.t += dt; if (p.t > 6.5) { um.push = null; return; }
    var g = geo(ui), M = g.mob, lh = M ? 21 : 16, pc = M ? cols(ui, g.W - 52, 12) : 22;
    var n = p.item, x = g.X + 16, y = g.Y + (M ? 54 : 40), w = g.W - 32, tl = util.wrap(n.title, pc).slice(0, 3), dl = util.wrap(n.desc, pc).slice(0, 4);
    var h = 10 + (M ? 24 : 16) + 8 + tl.length * lh + 4 + dl.length * lh + 12, col = SEV[n.severity] || PAL.blue, blink = p.t < 0.8 && U.A11y.blink(p.t, 5);
    ui.rect(x, y, w, h, { fill: '30;30;52', border: blink ? '255;255;255' : col, bw: 3, modal: true, block: true });
    var hy = M ? 44 : 34;
    ui.icon('pn:i', n.icon || 'noticia', x + 8, y + 8, 1, { z: 330 });
    ui.text('pn:h', 'NOTICIA - ahora', x + 30, y + (M ? 10 : 12), { size: 8, color: PAL.dim, z: 330 });
    chips(ui, 'pn:c', n.lines, x + w - 6, y + 8, run, true);
    ui.lines('pn:t', tl, x + 10, y + hy, { size: 12, z: 330, lineH: 16 });
    ui.lines('pn:d', dl, x + 10, y + hy + tl.length * lh + 4, { size: 12, z: 330, color: '200;205;228', lineH: 16 });
    if (ui.inside(x, y, w, h) && ui.released) { um.phone.app = 'news'; um.phone.scroll = 0; run.unread = 0; um.push = null; }
  };
  U.Phone = Phone;
})();
