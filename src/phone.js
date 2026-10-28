/* UrbanMex · phone — el celular del jugador (única guía del juego): Noticias, Ruta, Saldo, Líneas y Ajustes.
 * Se puede ocultar (botón X) y volver a abrir con el icono de la esquina superior derecha. Los avisos de noticias
 * aparecen como notificación DENTRO del celular. Se dibuja con la UI de modo inmediato en la capa "UI". */
(function () {
  var U = gdjs.UrbanMex, util = U.util, PAL = U.UI.PAL;
  if (U.Phone) return;

  var X = 920, Y = 64, W = 340, H = 560;
  var SEV = { danger: PAL.red, warning: PAL.yellow, success: PAL.green, info: PAL.blue };
  var APPS = [
    { id: 'news', label: 'NOTICIAS', icon: 'noticia', fill: '120;40;40' },
    { id: 'map', label: 'RUTA', icon: 'mapa', fill: '30;70;110' },
    { id: 'saldo', label: 'SALDO', icon: 'saldo', fill: '30;90;60' },
    { id: 'lines', label: 'LINEAS', icon: 'lineas', fill: '90;50;110' },
    { id: 'config', label: 'AJUSTES', icon: 'ajustes', fill: '70;70;90' }
  ];

  /** Cuadritos con el color y la letra/número de cada línea afectada, alineados a la derecha en rx. */
  function chips(ui, key, lines, rx, y, run, modal) {
    (lines || []).forEach(function (l, k) {
      var x0 = rx - (k + 1) * 22 + 4, ln = run.data.lines[l]; if (!ln) return;
      ui.rect(x0, y, 18, 16, { fill: util.hex(ln.color), border: '255;255;255', bw: 1, modal: modal });
      ui.text(key + k, l, x0 + 9, y + 4, { size: 8, align: 'center', color: '16;14;30', z: modal ? 335 : 205 });
    });
  }

  function cardLines(n) {
    return { t: util.wrap(n.title, 24), d: util.wrap(n.desc, 24), i: util.wrap(n.impact, 24) };   // letra de 12 px (antes 8)
  }

  var Phone = {
    rect: { x: X, y: Y, w: W, h: H },
    newPhoneState: function () { return { app: 'home', scroll: 0, open: true }; },

    draw: function (ui, um, run) {
      var ph = um.phone, sx = X + 10, sy = Y + 34, sw = W - 20;
      if (!ph.open) return;
      if (ph.app !== 'lines' && um.map.highlight) um.map.highlight = null;       // al salir de LINEAS el mapa vuelve a la normalidad
      ui.rect(X, Y, W, H, { fill: '8;8;14', border: '70;70;95', bw: 4, block: true });
      ui.rect(sx, sy, sw, H - 34 - 52, { fill: '12;12;30', border: '30;30;55', bw: 2, block: true });
      ui.text('ph:clk', util.clock(run.minute), X + 18, Y + 12, { size: 8 });
      ui.text('ph:net', 'LTE', X + W - 46, Y + 12, { size: 8, align: 'right', color: PAL.dim });
      if (ui.button('ph:hide', 'X', X + W - 34, Y + 6, 26, 22, { fill: '150;50;50', size: 8 })) um.setPhone(false);   // ocultar el celular
      var top = sy + 10;

      if (ph.app === 'home') {
        ui.text('ph:h', 'MI CELULAR', X + W / 2, top, { size: 8, align: 'center', color: PAL.dim });
        APPS.forEach(function (a, i) {
          var ax = sx + 8 + (i % 2) * 158, ay = top + 28 + Math.floor(i / 2) * 124;
          ui.rect(ax, ay, 150, 112, { fill: a.fill, border: '255;255;255', bw: 2, block: true });
          ui.icon('ph:ai' + a.id, a.icon, ax + 51, ay + 16, 3);
          ui.text('ph:al' + a.id, a.label, ax + 75, ay + 82, { size: 8, align: 'center' });
          if (a.id === 'news' && run.unread > 0) {
            ui.rect(ax + 124, ay + 4, 22, 18, { fill: PAL.red, border: '255;255;255', bw: 2 });
            ui.text('ph:badge', String(Math.min(run.unread, 99)), ax + 135, ay + 9, { size: 8, align: 'center' });
          }
          if (ui.inside(ax, ay, 150, 112) && ui.released) { ph.app = a.id; ph.scroll = 0; if (a.id === 'news') run.unread = 0; }
        });
      } else {
        var app = APPS.filter(function (a) { return a.id === ph.app; })[0];
        ui.rect(sx, sy, sw, 32, { fill: app.fill, border: '255;255;255', bw: 2 });
        ui.icon('ph:hi', app.icon, sx + 8, sy + 8, 1);
        ui.text('ph:ht', app.label, sx + 34, sy + 12, { size: 8 });
        if (ui.button('ph:back', '<', sx + sw - 34, sy + 4, 28, 24, { fill: '60;60;90', size: 8 })) ph.app = 'home';
        Phone['_' + ph.app](ui, um, run, sx + 8, sy + 42, sw - 16, H - 34 - 52 - 52);
      }
      if (ui.button('ph:homebtn', 'INICIO', X + W / 2 - 46, Y + H - 40, 92, 26, { fill: '60;60;90', size: 8 })) ph.app = 'home';
    },

    _news: function (ui, um, run, x, y, w, h) {
      var log = run.newsLog, ph = um.phone, maxScroll = Math.max(0, log.length - 1);
      run.unread = 0;                                                            // estás leyendo: nada sin leer
      if (ui.inside(X, Y, W, H) && ui.wheel) ph.scroll = util.clamp(ph.scroll + (ui.wheel > 0 ? 1 : -1), 0, maxScroll);
      ph.scroll = util.clamp(ph.scroll, 0, maxScroll);
      if (!log.length) { ui.text('ph:ne', 'Sin noticias aun', x + w / 2, y + 40, { size: 8, align: 'center', color: PAL.dim }); return; }
      var cy = y, shown = 0;
      for (var i = ph.scroll; i < log.length; i++) {
        var n = log[i], L = cardLines(n), ch = 12 + 10 + (L.t.length + L.d.length + L.i.length) * 16 + 12;
        if (cy + ch > y + h - 30 && shown > 0) break;
        var col = SEV[n.severity] || PAL.blue;
        ui.rect(x, cy, w, ch, { fill: '24;24;46', border: col, bw: 2 });
        ui.text('ph:n' + shown + 'h', n.time + '  ' + n.type.toUpperCase(), x + 8, cy + 8, { size: 8, color: PAL.dim });
        chips(ui, 'ph:n' + shown + 'c', n.lines, x + w - 6, cy + 5, run, false);
        var ty = cy + 24, k = 'ph:n' + shown;
        ty += ui.lines(k + 't', L.t, x + 8, ty, { size: 12, lineH: 16 });
        ty += ui.lines(k + 'd', L.d, x + 8, ty, { size: 12, color: '170;176;204', lineH: 16 });
        ui.lines(k + 'i', L.i, x + 8, ty, { size: 12, color: PAL.orange, lineH: 16 });
        cy += ch + 6; shown++;
      }
      ui.text('ph:npos', (ph.scroll + 1) + '/' + log.length + ' (rueda del raton)', x + w / 2, y + h - 14, { size: 8, align: 'center', color: PAL.dim });
      if (ui.button('ph:up', '^', x + w - 62, y + h - 22, 28, 20, { fill: '60;60;90' })) ph.scroll = Math.max(0, ph.scroll - 1);
      if (ui.button('ph:dn', 'v', x + w - 30, y + h - 22, 28, 20, { fill: '60;60;90' })) ph.scroll = Math.min(maxScroll, ph.scroll + 1);
    },

    _map: function (ui, um, run, x, y, w) {
      var lv = run.level, cfg = run.data.config, left = cfg.dayEndMinute - run.minute;
      var rows = [['ORIGEN', lv.start], ['META', lv.goal], ['ESTAS EN', run.current], ['HORA LIMITE', util.clock(cfg.dayEndMinute)],
                  ['TIEMPO LIBRE', util.duration(left)], ['ESTACIONES', String(run.steps)]];
      var cy = y;
      rows.forEach(function (r, i) {
        ui.text('ph:mr' + i, r[0], x, cy, { size: 8, color: PAL.blue });
        ui.text('ph:mv' + i, util.wrap(r[1], 32).join('\n'), x, cy + 14, { size: 8, lineH: 12 });
        cy += 14 + util.wrap(r[1], 32).length * 12 + 8;
      });
      ui.text('ph:mtip', util.wrap('Las vias naranja-rojas del mapa tienen retraso. Las moradas estan bloqueadas.', 31).join('\n'), x, cy + 6, { size: 8, color: PAL.yellow, lineH: 12 });
    },

    /** Qué color es cada línea; tocar una la resalta en el mapa. También explica bloqueo / peligro / retraso. */
    _lines: function (ui, um, run, x, y, w) {
      var ids = Object.keys(run.data.lines), count = {}, hl = um.map.highlight;
      run.data.stationList.forEach(function (st) { count[st.line] = (count[st.line] || 0) + 1; });
      ids.forEach(function (id, i) {
        var ln = run.data.lines[id], ry = y + i * 40, on = hl === id;
        ui.rect(x, ry, w, 34, { fill: on ? '44;44;80' : '24;24;46', border: on ? '255;255;255' : '60;60;90', bw: 2, block: true });
        ui.rect(x + 6, ry + 5, 24, 24, { fill: util.hex(ln.color), border: '255;255;255', bw: 2 });
        ui.text('ph:lk' + i, id, x + 18, ry + 13, { size: 8, align: 'center', color: '16;14;30' });
        ui.text('ph:ln' + i, ln.name.toUpperCase(), x + 40, ry + 4, { size: 12 });
        ui.text('ph:lc' + i, (ln.colorName || '').toUpperCase(), x + 40, ry + 21, { size: 8, color: util.hex(ln.color) });
        ui.text('ph:ls' + i, (count[id] || 0) + ' est.', x + w - 8, ry + 13, { size: 8, align: 'right', color: PAL.dim });
        if (ui.inside(x, ry, w, 34) && ui.released) um.map.highlight = on ? null : id;
      });
      var cy = y + ids.length * 40 + 2;
      cy += ui.text('ph:lh', util.wrap('Toca una linea para verla en el mapa.', 31).join('\n'), x, cy, { size: 8, color: PAL.yellow, lineH: 12 }) + 8;
      ui.text('ph:lg', 'COMO LEER LAS NOTICIAS', x, cy, { size: 8, color: PAL.orange }); cy += 18;
      [['BLOQUEO: solo se cierra esa estacion, no toda la linea. Busca otra ruta.', PAL.purple],
       ['PELIGRO: puede haber asaltos en esa estacion.', PAL.red],
       ['RETRASO: viajar por esa linea tarda mas minutos.', PAL.yellow],
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
      rows.forEach(function (r, i) {
        ui.rect(x, y + 108 + i * 34, w, 28, { fill: '24;24;46', border: '60;60;90', bw: 2 });
        ui.text('ph:sr' + i, r[0], x + 8, y + 108 + i * 34 + 10, { size: 8, color: PAL.dim });
        ui.text('ph:sv' + i, r[1], x + w - 8, y + 108 + i * 34 + 10, { size: 8, align: 'right' });
      });
    },

    _config: function (ui, um, run, x, y, w) {
      var rows = [['DIA', run.level.day], ['NIVEL', run.level.id + '/' + run.data.levels.length], ['PASOS', String(run.steps)],
                  ['NOTICIAS', String(run.newsCount)], ['VERSION', U.VERSION]];
      rows.forEach(function (r, i) {
        ui.text('ph:cr' + i, r[0], x, y + i * 24, { size: 8, color: PAL.dim });
        ui.text('ph:cv' + i, r[1], x + w, y + i * 24, { size: 8, align: 'right' });
      });
      if (ui.button('ph:menu', 'SALIR AL MENU', x, y + 150, w, 28, { fill: '150;50;50' })) um.exitToMenu = true;
    }
  };

  /** Aviso de noticia como notificación del propio celular (arriba de su pantalla). Tocarlo abre Noticias. */
  Phone.drawPush = function (ui, um, run, dt) {
    var p = um.push; if (!p) return;
    if (!um.phone.open) { um.push = null; return; }
    p.t += dt; if (p.t > 6.5) { um.push = null; return; }
    var n = p.item, x = X + 16, y = Y + 40, w = W - 32, tl = util.wrap(n.title, 22).slice(0, 3), dl = util.wrap(n.desc, 22).slice(0, 4);
    var h = 10 + 16 + 8 + tl.length * 16 + 4 + dl.length * 16 + 12, col = SEV[n.severity] || PAL.blue, blink = p.t < 0.8 && Math.floor(p.t * 8) % 2 === 0;
    ui.rect(x, y, w, h, { fill: '30;30;52', border: blink ? '255;255;255' : col, bw: 3, modal: true, block: true });
    ui.icon('pn:i', n.icon || 'noticia', x + 8, y + 8, 1, { z: 330 });
    ui.text('pn:h', 'NOTICIA - ahora', x + 30, y + 12, { size: 8, color: PAL.dim, z: 330 });
    chips(ui, 'pn:c', n.lines, x + w - 6, y + 8, run, true);
    ui.lines('pn:t', tl, x + 10, y + 34, { size: 12, z: 330, lineH: 16 });
    ui.lines('pn:d', dl, x + 10, y + 34 + tl.length * 16 + 4, { size: 12, z: 330, color: '200;205;228', lineH: 16 });
    if (ui.inside(x, y, w, h) && ui.released) { um.phone.app = 'news'; um.phone.scroll = 0; run.unread = 0; um.push = null; }
  };
  U.Phone = Phone;
})();
