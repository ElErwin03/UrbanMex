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

  /** Bloqueos permanentes (los de una huelga reabren solos: no cuentan para decidir si una noticia es segura). */
  function permBlocked(run) { var o = {}; Object.keys(run.blocked).forEach(function (k) { if (!run.striking || !run.striking[k]) o[k] = true; }); return o; }

  var News = {
    /** ¿Es seguro aplicar esta noticia? (no bloquea la meta ni aísla al jugador de ella) */
    isSafe: function (run, item) {
      var blocks = (item.effects && item.effects.block) || [];
      if (!blocks.length) return true;
      var nb = permBlocked(run);
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
        var pb = permBlocked(run), redundant = blocks.length > 0 && blocks.every(function (b) { return pb[b]; });   // no repetir un bloqueo que ya existe
        return !run.newsUsed[n.id] && !redundant && (!onlyType || n.type === onlyType) && News.isSafe(run, n);
      });
    },

    /** Noticia de un EVENTO DEL DÍA (events.js): kind 'start' | 'end' | 'now' | 'soon'. Con unread = true suma al globo del celular. */
    event: function (run, ev, kind, unread) {
      var t = U.Events.text(run, ev, kind);
      run.newsLog.unshift(stamp(run, { id: 'ev:' + ev.id + ':' + kind, type: 'evento', title: t.title, desc: t.desc, impact: t.impact, severity: t.severity,
                                       icon: ev.icon, effects: {} }));
      if (ev.line) run.newsLog[0].lines = [ev.line];
      if (unread) { run.unread++; run.newsCount++; }
      return t;
    },

    /** Vacía la cola de cambios de eventos (los deja Rules al correr el reloj) en el celular. Devuelve lo anunciado: [{ id, kind, title, severity }]. */
    drain: function (run) {
      var q = run.eventQueue || [], out = [], byId = {};
      run.eventQueue = [];
      U.Events.list(run).forEach(function (e) { byId[e.id] = e; });
      q.forEach(function (t) {
        var ev = byId[t.id]; if (!ev) return;
        if (t.kind === 'wait') { News.info(run, 'ESPERASTE A QUE REABRA', 'Sin otra salida, esperaste de ' + util.clock(t.from) + ' a ' + util.clock(t.to) + '.', 'Perdiste ' + (t.to - t.from) + ' min'); out.push({ id: t.id, kind: 'wait', title: 'ESPERASTE ' + (t.to - t.from) + ' MIN', severity: 'warning', entry: run.newsLog[0] }); return; }
        var x = News.event(run, ev, t.kind, true); out.push({ id: t.id, kind: t.kind, title: x.title, severity: x.severity, entry: run.newsLog[0] });
      });
      return out;
    },

    /** Mensajes iniciales del nivel. */
    intro: function (run) {
      var lv = run.level, cfg = run.data.config;
      News.info(run, lv.infinite ? 'Ronda ' + lv.round : 'Nivel ' + lv.id + ': ' + lv.day, lv.startDesc,
        'Meta: ' + lv.goal + ' | Tienes hasta las ' + util.clock(cfg.dayEndMinute));
      U.Events.list(run).forEach(function (ev) { News.event(run, ev, run.minute >= ev.from ? 'now' : 'soon', false); });   // eventos del día (sin globo de no leídas)
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
