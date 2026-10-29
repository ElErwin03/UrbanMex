/* UrbanMex · news — generador de noticias del celular (puro).
 * Garantiza que ninguna noticia aleatoria deje la meta inalcanzable (antes podía pasar). */
(function () {
  var U = gdjs.UrbanMex, G = U.Graph, util = U.util, R = U.Rules;
  if (U.News) return;

  /** Líneas del Metro que toca la noticia (para mostrar sus colores en el celular). */
  function linesOf(run, item) {
    var e = item.effects || {}, out = [], st = run.data.stations;
    function add(l) { if (l && out.indexOf(l) < 0) out.push(l); }
    (e.danger || []).concat(e.block || []).forEach(function (n) { if (st[n]) add(st[n].line); });
    if (e.timeMod) add(e.timeMod.line);
    return out.slice(0, 4);
  }
  function stamp(run, item) {
    return { id: item.id, type: item.type, title: item.title, desc: item.desc, impact: item.impact,
             severity: item.severity, icon: item.icon, time: util.clock(run.minute), lines: linesOf(run, item) };
  }

  var News = {
    /** ¿Es seguro aplicar esta noticia? (no bloquea la meta ni aísla al jugador de ella) */
    isSafe: function (run, item) {
      var blocks = (item.effects && item.effects.block) || [];
      if (!blocks.length) return true;
      var nb = {}; Object.keys(run.blocked).forEach(function (k) { nb[k] = true; });
      blocks.forEach(function (s) { nb[s] = true; });
      if (nb[run.level.goal]) return false;
      return G.reachable(run.graph, run.current, run.level.goal, nb);
    },

    /** Añade una noticia informativa (sin efectos) al registro. */
    info: function (run, title, desc, impact) {
      run.newsLog.unshift(stamp(run, { id: 'info', type: 'info', title: title, desc: desc, impact: impact,
                                       severity: 'info', icon: 'noticia' }));
    },

    /** Lanza una noticia del catálogo: la registra, aplica sus efectos y la devuelve (o null). */
    trigger: function (run, item) {
      if (run.newsUsed[item.id]) return null;
      run.newsUsed[item.id] = true;
      run.newsLog.unshift(stamp(run, item));
      run.unread++; run.newsCount++;
      R.applyNews(run, item);
      return item;
    },

    eligible: function (run, onlyType) {
      return run.data.news.filter(function (n) {
        var blocks = (n.effects && n.effects.block) || [];
        var redundant = blocks.length > 0 && blocks.every(function (b) { return run.blocked[b]; });   // no repetir un bloqueo que ya existe
        return !run.newsUsed[n.id] && !redundant && (!onlyType || n.type === onlyType) && News.isSafe(run, n);
      });
    },

    /** Mensajes iniciales del nivel. */
    intro: function (run) {
      var lv = run.level, cfg = run.data.config;
      News.info(run, 'Nivel ' + lv.id + ': ' + lv.day, lv.startDesc,
        'Meta: ' + lv.goal + ' | Tienes hasta las ' + util.clock(cfg.dayEndMinute));
      News.info(run, 'Tip del dia', 'Revisa las noticias ANTES de viajar. El mapa no te avisa de peligros ni bloqueos.',
        'Abre la app de Noticias');
    },

    /** El jugador acaba de moverse: las noticias solo llegan así (nunca con el reloj parado). Devuelve la noticia lanzada o null.
     *  config.news: firstAfterMoves (movimientos hasta la primera, siempre de seguridad), everyMoves [min, max] entre noticias y chance. */
    onMove: function (run) {
      if (run.over) return null;
      var n = run.data.config.news, first = run.newsCount === 0;
      run.newsMoves--;
      if (run.newsMoves > 0) return null;
      run.newsMoves = Math.floor(util.range(run.rnd, n.everyMoves[0], n.everyMoves[1] + 1));
      if (!first && run.rnd() >= n.chance) return null;
      var pool = News.eligible(run, first ? 'security' : null);
      if (!pool.length) return null;
      return News.trigger(run, util.pick(run.rnd, pool));
    }
  };
  U.News = News;
})();
