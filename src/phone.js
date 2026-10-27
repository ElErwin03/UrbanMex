/* UrbanMex · phone — el celular del jugador (única guía del juego): Noticias, Ruta, Saldo y Ajustes.
 * Se dibuja con la UI de modo inmediato en la capa "UI". */
(function () {
  var U = gdjs.UrbanMex, util = U.util, PAL = U.UI.PAL;
  if (U.Phone) return;

  var X = 950, Y = 64, W = 310, H = 560;
  var SEV = { danger: PAL.red, warning: PAL.yellow, success: PAL.green, info: PAL.blue };
  var APPS = [
    { id: 'news', label: 'NOTICIAS', icon: 'noticia', fill: '120;40;40' },
    { id: 'map', label: 'RUTA', icon: 'mapa', fill: '30;70;110' },
    { id: 'saldo', label: 'SALDO', icon: 'saldo', fill: '30;90;60' },
    { id: 'config', label: 'AJUSTES', icon: 'ajustes', fill: '70;70;90' }
  ];

  function cardLines(n) {
    return { t: util.wrap(n.title, 30), d: util.wrap(n.desc, 31), i: util.wrap(n.impact, 31) };
  }

  var Phone = {
    rect: { x: X, y: Y, w: W, h: H },
    newPhoneState: function () { return { app: 'home', scroll: 0 }; },

    draw: function (ui, um, run) {
      var ph = um.phone, sx = X + 10, sy = Y + 34, sw = W - 20;
      ui.rect(X, Y, W, H, { fill: '8;8;14', border: '70;70;95', bw: 4, block: true });
      ui.rect(sx, sy, sw, H - 34 - 52, { fill: '12;12;30', border: '30;30;55', bw: 2, block: true });
      ui.text('ph:clk', util.clock(run.minute), X + 18, Y + 12, { size: 8 });
      ui.text('ph:net', 'LTE', X + W - 18, Y + 12, { size: 8, align: 'right', color: PAL.dim });
      var top = sy + 10;

      if (ph.app === 'home') {
        ui.text('ph:h', 'MI CELULAR', X + W / 2, top, { size: 8, align: 'center', color: PAL.dim });
        APPS.forEach(function (a, i) {
          var ax = sx + 8 + (i % 2) * 138, ay = top + 28 + Math.floor(i / 2) * 124;
          ui.rect(ax, ay, 130, 112, { fill: a.fill, border: '255;255;255', bw: 2, block: true });
          ui.icon('ph:ai' + a.id, a.icon, ax + 41, ay + 16, 3);
          ui.text('ph:al' + a.id, a.label, ax + 65, ay + 82, { size: 8, align: 'center' });
          if (a.id === 'news' && run.unread > 0) {
            ui.rect(ax + 104, ay + 4, 22, 18, { fill: PAL.red, border: '255;255;255', bw: 2 });
            ui.text('ph:badge', String(Math.min(run.unread, 99)), ax + 115, ay + 9, { size: 8, align: 'center' });
          }
          if (ui.inside(ax, ay, 130, 112) && ui.released) { ph.app = a.id; ph.scroll = 0; if (a.id === 'news') run.unread = 0; }
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
      if (ui.inside(X, Y, W, H) && ui.wheel) ph.scroll = util.clamp(ph.scroll + (ui.wheel > 0 ? 1 : -1), 0, maxScroll);
      ph.scroll = util.clamp(ph.scroll, 0, maxScroll);
      if (!log.length) { ui.text('ph:ne', 'Sin noticias aun', x + w / 2, y + 40, { size: 8, align: 'center', color: PAL.dim }); return; }
      var cy = y, shown = 0;
      for (var i = ph.scroll; i < log.length; i++) {
        var n = log[i], L = cardLines(n), ch = 12 + 8 + (L.t.length + L.d.length + L.i.length) * 12 + 10;
        if (cy + ch > y + h - 30 && shown > 0) break;
        var col = SEV[n.severity] || PAL.blue;
        ui.rect(x, cy, w, ch, { fill: '24;24;46', border: col, bw: 2 });
        ui.text('ph:n' + shown + 'h', n.time + '  ' + n.type.toUpperCase(), x + 8, cy + 8, { size: 8, color: PAL.dim });
        var ty = cy + 22;
        ty += ui.text('ph:n' + shown + 't', L.t.join('\n'), x + 8, ty, { size: 8, lineH: 12 });
        ty += ui.text('ph:n' + shown + 'd', L.d.join('\n'), x + 8, ty, { size: 8, color: '175;180;205', lineH: 12 });
        ui.text('ph:n' + shown + 'i', L.i.join('\n'), x + 8, ty, { size: 8, color: PAL.orange, lineH: 12 });
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
      ui.text('ph:mtip', util.wrap('Las lineas rojas del mapa tienen retraso. Las moradas estan bloqueadas.', 31).join('\n'), x, cy + 6, { size: 8, color: PAL.yellow, lineH: 12 });
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
  U.Phone = Phone;
})();
