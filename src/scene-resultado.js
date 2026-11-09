/* UrbanMex · escena Resultado — fin de cada jornada. Objetos: Texto, Icono, UIBase, UIModal.
 * Ganar: hasta 3 estrellas (llegar / ahorrar / sin asaltos), mejor marca y aviso de récord, consejo para la estrella que falta.
 * Perder: qué tan cerca quedaste (barra de avance) y un consejo según lo que te frenó. */
(function () {
  var U = gdjs.UrbanMex, PAL = U.UI.PAL, util = U.util;
  U.Scenes = U.Scenes || {};
  if (U.Scenes.resultado) return;

  var STAR = { size: 5, gap: 220, top: 126, first: 0.5, every: 0.5, pop: 0.4 };   // estrellas: escala (16 px × 5), separación, aparición escalonada
  function easeOutBack(p) { var c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

  /** Textos del resultado (puros: los usan la escena y las pruebas). */
  var Text = {
    title: function (r) {
      if (r.won) return r.stars >= 3 ? 'PERFECTO!' : r.stars === 2 ? 'MUY BIEN!' : 'LLEGASTE!';
      return r.left !== null && r.left <= 3 ? 'CASI!' : 'NO LLEGASTE';
    },
    /** Frase principal de la tarjeta de ánimo. */
    headline: function (r) {
      if (r.won) return r.stars >= 3 ? 'Tres estrellas: te mueves por la ciudad como nadie.'
        : r.stars === 2 ? 'Casi perfecto: te falta 1 estrella.' : 'Llegaste! Ahora ve por las 3 estrellas.';
      if (r.streak) return r.streak.cleared ? 'Tu racha termina: aguantaste ' + r.streak.cleared + (r.streak.cleared === 1 ? ' ronda!' : ' rondas!') : 'Tu racha termina en la primera ronda.';
      if (r.left === 0) return 'Estabas en la meta, pero ya no pudiste seguir.';
      if (r.left !== null && r.left <= 3) return 'Te faltaron solo ' + r.left + (r.left === 1 ? ' estación!' : ' estaciones!');
      return 'Cada intento te enseña una ruta nueva.';
    },
    /** Consejo concreto (según la estrella que falta o lo que te frenó). */
    tip: function (r) {
      if (r.won) {
        if (r.stars >= 3) return 'Prueba otro día de la semana o supera tu mejor marca de dinero.';
        if (!r.got.saver) return 'Ahorra: planea la ruta y revisa tu saldo antes de moverte (meta: ' + r.moneyGoal + ' o más).';
        return 'Evita las estaciones peligrosas: las noticias avisan dónde hay asaltos.';
      }
      if (r.cause === 'stamina') return 'Consejo: compra un Monster en una tienda antes de quedarte sin stamina.';
      if (r.cause === 'money') return r.stolen > 0 ? 'Consejo: los asaltos te quitaron ' + r.stolen + '. Evita las estaciones peligrosas.' : 'Consejo: revisa tu saldo y elige tramos baratos.';
      if (r.cause === 'night') return 'Consejo: las fallas de línea retrasan el viaje; busca rutas alternas a tiempo.';
      return 'Consejo: lee las noticias, avisan de cierres antes de que te afecten.';
    },
    /** Qué dice cada estrella: [etiqueta, pista]. */
    starInfo: function (r, i) {
      var cur = r.currency;
      if (i === 0) return ['LLEGAR', r.won ? 'Llegaste a la meta' : 'Llega a la meta'];
      if (i === 1) return ['AHORRAR', r.got.saver ? 'Terminaste con ' + r.money : 'Termina con ' + r.moneyGoal + ' o más'];
      return ['SIN ASALTOS', r.got.safe ? 'Nadie te robó' : (r.robbed ? r.robbed + (r.robbed === 1 ? ' asalto' : ' asaltos') + ' (-' + r.stolen + ')' : 'No te asaltes')];
    },
    /** Cierre de semana (o del juego): cuántas estrellas llevas en esa semana o en todo el juego. */
    weekEnd: function (levelIndex, last, total) {
      var wk = Math.floor(levelIndex / U.Save.WEEK);
      return last ? 'COMPLETASTE TODOS LOS NIVELES!  ' + U.Save.totalStars(total) + '/' + total * 3 + ' estrellas'
                  : 'COMPLETASTE LA SEMANA ' + (wk + 1) + '!  ' + U.Save.weekStars(wk) + '/' + U.Save.WEEK * 3 + ' estrellas';
    },
    /** Modo infinito: línea de la racha (rondas ganadas, estrellas y mejor marca). */
    streak: function (r) {
      var s = r.streak; if (!s) return null;
      var plural = function (n) { return n + (n === 1 ? ' ronda' : ' rondas'); };
      return { new: s.newBest, text: (s.newBest ? 'NUEVA MEJOR RACHA!  ' : 'RACHA: ') + plural(s.cleared) + '  -  ' + s.stars + ' estrellas' + (s.newBest ? '' : '   (mejor: ' + plural(s.best.best) + ')') };
    },
    record: function (r, cur) {
      if (!r.won || !r.record) return null;
      if (r.record.isNew) return { new: true, text: r.record.prev ? 'NUEVO RECORD!  Antes: ' + r.record.prev.stars + (r.record.prev.stars === 1 ? ' estrella, ' : ' estrellas, ') + r.record.prev.money : 'PRIMERA MARCA GUARDADA!' };
      var b = r.record.prev; return { new: false, text: 'Tu mejor marca: ' + b.stars + (b.stars === 1 ? ' estrella' : ' estrellas') + ', ' + b.money + ' ' + cur };
    }
  };

  U.Scenes.resultado = function (scene) {
    var ui = U.UI.of(scene), r = U.session.lastResult, data = U.Data.ready(scene);
    ui.begin();
    var dt = Math.min(0.1, scene.getElapsedTime() / 1000), t = scene._umT = (scene._umT || 0) + dt;
    (scene._umFx || (scene._umFx = U.FX.ambient(scene, 'neutral'))).update(dt, !r ? 'neutral' : r.won ? 'win' : 'lose');   // resplandor verde / rojo según el resultado
    U.Audio.tick(scene, 'menu', dt);
    if (r && !scene._umJingle) { scene._umJingle = true; U.Audio.play(scene, r.won ? 'ganar' : 'perder'); }   // fanfarria suave, una vez
    if (!r || !data) {
      ui.text('x', 'Sin resultado', 640, 340, { size: 16, align: 'center' });
      if (ui.button('m', 'MENU', 540, 400, 200, 44, {})) scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, 'Menu');
      ui.end(); return;
    }
    var inf = !!r.infinite, last = !inf && !U.Rules.hasNextLevel(data, r.levelIndex), week = !inf && r.won && (last || (r.levelIndex + 1) % U.Save.WEEK === 0), calm = U.A11y.calm(), M = ui.mob;      // M: modo celular (letras de 12 px, botones de 44 px o más)
    ui.text('t', Text.title(r), 640, 56, { size: 24, align: 'center', color: r.won ? (r.stars >= 3 ? PAL.yellow : PAL.green) : r.left !== null && r.left <= 3 ? PAL.orange : PAL.red });
    ui.text('d', inf ? 'RONDA ' + r.infinite.round : 'NIVEL ' + (r.levelIndex + 1) + ' - ' + r.day, 640, 100, { size: 8, align: 'center', color: PAL.dim });

    if (r.won) {                                    // ---- tres estrellas
      scene._umStar = scene._umStar || {};
      for (var i = 0; i < 3; i++) {
        var cx = 640 + (i - 1) * STAR.gap, earned = !!r.got[['arrive', 'saver', 'safe'][i]], t0 = STAR.first + i * STAR.every;
        var p = util.clamp((t - t0) / STAR.pop, 0, 1), sc = STAR.size * (earned && p > 0 && p < 1 && !calm ? easeOutBack(p) : 1), px = 16 * sc;
        ui.icon('st' + i, earned && p > 0 ? 'estrella' : 'estrella_vacia', cx - px / 2, STAR.top + (80 - px) / 2, sc);
        if (earned && p > 0 && !scene._umStar[i]) { scene._umStar[i] = true; U.Audio.play(scene, 'moneda'); }   // un "ding" por estrella ganada
        var info = Text.starInfo(r, i);
        ui.text('sl' + i, info[0], cx, 224, { size: 8, align: 'center', color: earned && p > 0 ? PAL.yellow : PAL.dim });
        ui.lines('sh' + i, util.wrap(info[1], M ? 17 : 22), cx, 244, { size: 8, lineH: 12, align: 'center', color: earned && p > 0 ? '230;234;250' : '120;124;150' });
      }
    } else {                                        // ---- qué tan lejos llegaste
      if (r.reason) ui.text('why', r.reason, 640, 132, { size: 8, align: 'center', color: PAL.yellow });
      var bx = 300, bw = 680, by = 196, fill = Math.max(0.02, r.progress) * Math.min(1, t / 0.9);   // la barra se llena al entrar
      ui.rect(bx, by, bw, 26, { fill: '24;24;46', border: '60;60;90', bw: 3 });
      if (fill > 0.001) ui.rect(bx + 3, by + 3, Math.max(4, (bw - 6) * fill), 20, { fill: r.left !== null && r.left <= 3 ? '230;140;40' : '200;60;50', border: '255;255;255', bw: 0 });
      ui.icon('pp', 'persona', util.clamp(bx + bw * fill - 16, bx - 4, bx + bw - 44), by - 40, 2);
      ui.icon('pg', 'meta', bx + bw - 16, by - 40, 2);
      var did = Math.max(0, r.hops - (r.left === null ? r.hops : r.left));
      ui.text('pt', r.left === null ? 'Avanzaste ' + r.steps + ' estaciones' : 'Avanzaste ' + did + ' de ' + r.hops + ' estaciones del camino más corto', 640, 236, { size: 8, align: 'center' });
    }

    var rows = [['reloj', M ? 'Llegada' : 'Hora de llegada', r.arrival], ['reloj', M ? 'Viaje' : 'Tiempo de viaje', r.travelTime], ['persona', 'Estaciones', String(r.steps)],
                ['moneda', 'Dinero', String(r.money)], ['alerta', 'Asaltos', (r.robbed ? r.robbed + ' (-' + r.stolen + ')' : '0')], ['noticia', M ? 'Noticias' : 'Noticias recibidas', String(r.newsRead)]];
    var rw = M ? 340 : 320, rg = M ? 20 : 40, rx0 = 640 - (2 * rw + rg) / 2, rh = M ? 40 : 38, ty = M ? 14 : 15;
    rows.forEach(function (row, i) {                // 2 columnas × 3 filas
      var x = rx0 + (i % 2) * (rw + rg), y = (M ? 294 : 292) + Math.floor(i / 2) * 46;
      ui.rect(x, y, rw, rh, { fill: '24;24;46', border: '60;60;90', bw: 2 });
      ui.icon('ri' + i, row[0], x + 10, y + (M ? 4 : 3), 2); ui.text('rl' + i, row[1], x + 52, y + ty, { size: 8, color: PAL.dim });
      ui.text('rv' + i, row[2], x + rw - 14, y + ty, { size: 8, align: 'right' });
    });

    var cy = 436, ch = M ? 106 : 70;
    ui.rect(300, cy, 680, ch, { fill: r.won ? '22;48;38' : '48;30;24', border: r.won ? '46;204;113' : '230;140;40', bw: 3 });
    if (M) {
      var hl = util.wrap(Text.headline(r), Math.floor(650 / ui.fs(12)));
      var hh = ui.lines('hl', hl, 640, cy + 10, { size: 12, lineH: 16, align: 'center', color: '255;255;255' });
      ui.lines('tp', util.wrap(Text.tip(r), 53), 640, cy + 14 + hh, { size: 8, lineH: 12, align: 'center', color: '230;234;250' });
    } else {
      ui.text('hl', Text.headline(r), 640, 450, { size: 12, align: 'center', color: '255;255;255' });
      ui.lines('tp', util.wrap(Text.tip(r), 78), 640, 478, { size: 8, lineH: 12, align: 'center', color: '230;234;250' });
    }

    var rec = inf ? Text.streak(r) : Text.record(r, r.currency);
    if (rec) ui.text('rec', rec.text, 640, M ? 550 : 520, { size: 8, align: 'center', color: rec.new ? PAL.yellow : PAL.dim });
    if (week) ui.text('w', Text.weekEnd(r.levelIndex, last, data.levels.length), 640, M ? 574 : 542, { size: 8, align: 'center', color: PAL.yellow });

    var got = (r.achievements || []).map(U.Achievements.byId).filter(Boolean);        // logros nuevos de esta partida (cartel arriba a la derecha)
    if (got.length) {
      var shown = got.slice(0, 3), bh = 34 + shown.length * 30 + (got.length > shown.length ? 14 : 0), bx = 920, pulse = calm ? 0 : Math.round(Math.sin(t * 5) * 20);
      ui.rect(bx, 14, 344, bh, { fill: '40;34;10', border: (235 + pulse) + ';' + (190 + pulse) + ';40', bw: 3 });
      ui.text('ac:h', got.length === 1 ? 'LOGRO DESBLOQUEADO!' : 'LOGROS DESBLOQUEADOS!', bx + 172, 24, { size: 8, align: 'center', color: PAL.yellow });
      shown.forEach(function (a, i) {
        ui.icon('ac:i' + i, 'trofeo', bx + 10, 40 + i * 30, 1.5); ui.text('ac:n' + i, a.name, bx + 44, 46 + i * 30, { size: 8, color: '255;255;255' });
      });
      if (got.length > shown.length) ui.text('ac:m', '+ ' + (got.length - shown.length) + ' mas en LOGROS', bx + 172, 38 + shown.length * 30 + 4, { size: 8, align: 'center', color: PAL.dim });
    }
    var go = function (name) { scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, name); };
    var btns = inf ? (r.won ? [['i', 'SIGUIENTE RONDA >', 300, '39;174;96']] : [['x', 'NUEVA RACHA', 300, '120;60;160']])
      : r.won ? (last ? [['a', 'JUGAR OTRA VEZ', 300, '39;174;96']] : [['n', 'SIGUIENTE NIVEL >', 300, '39;174;96']]) : [['r', 'REINTENTAR', 300, '39;174;96']];
    if (!inf && r.won && r.stars < 3) btns.push(['rt', 'MEJORAR ESTRELLAS', 250, '70;100;160']);
    btns.push(['m', 'MENU', 150, '70;70;100']);
    var total = btns.reduce(function (s, b) { return s + b[2]; }, 0) + 20 * (btns.length - 1), x = (1280 - total) / 2;
    btns.forEach(function (b) {
      if (ui.button(b[0], b[1], x, M ? 618 : 574, b[2], 52, { size: 8, fill: b[3] })) {
        if (b[0] === 'i') { U.session.infinite.round++; go('Nivel'); }
        else if (b[0] === 'x') { U.Infinite.start(); go('Nivel'); }
        else if (b[0] === 'n') { U.session.levelIndex = r.levelIndex + 1; go('Nivel'); }
        else if (b[0] === 'r' || b[0] === 'rt') { U.session.levelIndex = r.levelIndex; go('Nivel'); }
        else if (b[0] === 'a') { U.session.levelIndex = 0; go('Nivel'); }
        else go('Menu');
      }
      x += b[2] + 20;
    });
    ui.end();
  };
  U.ResultText = Text;
})();
