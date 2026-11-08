/* UrbanMex · achievements — LOGROS (puro, sin motor). Al terminar cada partida (nivel o ronda del modo infinito) se suman las estadísticas y se revisan
 * todos los logros; los nuevos se guardan y la pantalla de resultado los anuncia. El menú tiene una pantalla con todos (los pendientes dicen qué hacer).
 * Cada logro es un dato: { id, group, name, desc, check(ctx), progress?(ctx) → [actual, meta] }. Agregar uno es agregar una línea.
 * ctx = { r: resumen de la partida (Rules.summary + extras), stats, completed, best, stars, streak (rondas ganadas de la racha infinita, o 0) }. */
(function () {
  var U = gdjs.UrbanMex;
  if (U.Achievements) return;

  var GROUPS = [['progreso', 'PROGRESO'], ['estilo', 'ESTILO DE JUEGO'], ['eventos', 'EVENTOS DEL DIA'], ['infinito', 'MODO INFINITO']];
  var STAT_KEYS = ['played', 'wins', 'steps', 'robbed', 'monsters', 'combis', 'news', 'safeWins'];     // estadísticas de toda la vida (se suman al terminar cada partida)
  var WEEK = 5;

  function won(c) { return !!(c.r && c.r.won); }
  function hasEvent(c, id) { return won(c) && (c.r.events || []).indexOf(id) >= 0; }
  function weekDone(c, w) { for (var i = w * WEEK; i < (w + 1) * WEEK; i++) if (c.completed.indexOf(i) < 0) return false; return true; }
  function count(c, w) { var n = 0; for (var i = w * WEEK; i < (w + 1) * WEEK; i++) if (c.completed.indexOf(i) >= 0) n++; return n; }
  function stat(key, goal) { return function (c) { return [Math.min(c.stats[key], goal), goal]; }; }

  /** El catálogo, en el orden en que se muestra. Los nombres van en mayúsculas sin acentos (la letra del juego no dibuja bien las acentuadas en mayúscula). */
  var LIST = [
    // ---- progreso
    { id: 'primer_viaje', group: 'progreso', name: 'PRIMER VIAJE', desc: 'Llega a la meta de un nivel.', check: function (c) { return c.stats.wins >= 1; } },
    { id: 'semana1', group: 'progreso', name: 'SEMANA 1', desc: 'Completa los niveles 1 a 5.', check: function (c) { return weekDone(c, 0); }, progress: function (c) { return [count(c, 0), WEEK]; } },
    { id: 'semana2', group: 'progreso', name: 'SEMANA 2', desc: 'Completa los niveles 6 a 10.', check: function (c) { return weekDone(c, 1); }, progress: function (c) { return [count(c, 1), WEEK]; } },
    { id: 'brillante', group: 'progreso', name: 'BRILLANTE', desc: 'Consigue las 3 estrellas en un nivel.', check: function (c) { return Object.keys(c.best).some(function (k) { return c.best[k].stars >= 3; }); } },
    { id: 'estrellado', group: 'progreso', name: 'ESTRELLADO', desc: 'Junta 15 estrellas en total.', check: function (c) { return c.stars >= 15; }, progress: function (c) { return [Math.min(c.stars, 15), 15]; } },
    { id: 'constelacion', group: 'progreso', name: 'CONSTELACION', desc: 'Consigue las 30 estrellas de los 10 niveles.', check: function (c) { return c.stars >= 30; }, progress: function (c) { return [Math.min(c.stars, 30), 30]; } },
    // ---- estilo de juego
    { id: 'ahorrador', group: 'estilo', name: 'AHORRADOR', desc: 'Llega con 100 monedas o más.', check: function (c) { return won(c) && c.r.money >= 100; } },
    { id: 'sin_monster', group: 'estilo', name: 'PURO ESFUERZO', desc: 'Llega sin comprar ningun Monster (en una ruta de 10 tramos o más).', check: function (c) { return won(c) && c.r.monsters === 0 && c.r.steps >= 10; } },
    { id: 'al_limite', group: 'estilo', name: 'AL LIMITE', desc: 'Llega a la meta con 10 de stamina o menos.', check: function (c) { return won(c) && c.r.stamina <= 10; } },
    { id: 'intocable', group: 'estilo', name: 'INTOCABLE', desc: 'Gana 3 niveles sin que te asalten.', check: function (c) { return c.stats.safeWins >= 3; }, progress: stat('safeWins', 3) },
    { id: 'bienvenido', group: 'estilo', name: 'BIENVENIDO A LA CIUDAD', desc: 'Que te asalten 3 veces en total. Le pasa a todos.', check: function (c) { return c.stats.robbed >= 3; }, progress: stat('robbed', 3) },
    { id: 'monster10', group: 'estilo', name: 'ADICTO AL MONSTER', desc: 'Compra 10 Monster en total.', check: function (c) { return c.stats.monsters >= 10; }, progress: stat('monsters', 10) },
    { id: 'combi5', group: 'estilo', name: 'REY DE LA COMBI', desc: 'Usa la combi 5 veces en total.', check: function (c) { return c.stats.combis >= 5; }, progress: stat('combis', 5) },
    { id: 'caminante', group: 'estilo', name: 'METRONAUTA', desc: 'Recorre 200 estaciones en total.', check: function (c) { return c.stats.steps >= 200; }, progress: stat('steps', 200) },
    { id: 'lector', group: 'estilo', name: 'BIEN INFORMADO', desc: 'Recibe 25 noticias en total.', check: function (c) { return c.stats.news >= 25; }, progress: stat('news', 25) },
    // ---- eventos del día
    { id: 'lluvia', group: 'eventos', name: 'BAJO LA LLUVIA', desc: 'Llega a la meta en un nivel con lluvia.', check: function (c) { return hasEvent(c, 'lluvia'); } },
    { id: 'hora_pico', group: 'eventos', name: 'HORA PICO', desc: 'Llega a la meta en un nivel con hora pico.', check: function (c) { return hasEvent(c, 'horaPico'); } },
    { id: 'huelga', group: 'eventos', name: 'ROMPEHUELGAS', desc: 'Llega a la meta en un nivel con huelga.', check: function (c) { return hasEvent(c, 'huelga'); } },
    { id: 'paciencia', group: 'eventos', name: 'PACIENCIA', desc: 'Espera a que reabra una línea en huelga y llega a la meta.', check: function (c) { return won(c) && c.r.waited > 0; } },
    { id: 'triple', group: 'eventos', name: 'DIA DE TODO', desc: 'Llega a la meta en un nivel con lluvia, hora pico y huelga a la vez.', check: function (c) { return hasEvent(c, 'lluvia') && hasEvent(c, 'horaPico') && hasEvent(c, 'huelga'); } },
    // ---- modo infinito
    { id: 'sin_fin', group: 'infinito', name: 'SIN FIN', desc: 'Gana tu primera ronda del modo infinito.', check: function (c) { return c.streak >= 1; } },
    { id: 'racha5', group: 'infinito', name: 'RACHA DE 5', desc: 'Gana 5 rondas seguidas.', check: function (c) { return c.streak >= 5 || c.infBest >= 5; }, progress: function (c) { return [Math.min(Math.max(c.streak, c.infBest), 5), 5]; } },
    { id: 'racha10', group: 'infinito', name: 'IMPARABLE', desc: 'Gana 10 rondas seguidas.', check: function (c) { return c.streak >= 10 || c.infBest >= 10; }, progress: function (c) { return [Math.min(Math.max(c.streak, c.infBest), 10), 10]; } }
  ];
  var BY_ID = {}; LIST.forEach(function (a) { BY_ID[a.id] = a; });

  function zero() { var o = {}; STAT_KEYS.forEach(function (k) { o[k] = 0; }); return o; }
  function sessionStats() { return U.session.stats || (U.session.stats = zero()); }
  function sessionAch() { return U.session.ach || (U.session.ach = {}); }

  /** Contexto para revisar los logros con el estado guardado (y, si hay, el resumen `r` de la partida que acaba de terminar). */
  function context(r, streak) {
    var best = U.session.best || {}, stars = 0; Object.keys(best).forEach(function (k) { stars += best[k].stars; });
    return { r: r || null, stats: sessionStats(), completed: U.session.completed || [], best: best, stars: stars, streak: streak || 0, infBest: (U.session.inf || {}).best || 0 };
  }

  var Achievements = {
    LIST: LIST, GROUPS: GROUPS, STAT_KEYS: STAT_KEYS, byId: function (id) { return BY_ID[id] || null; },
    zero: zero,

    /** ¿Ya lo tienes? */
    has: function (id) { return !!sessionAch()[id]; },
    /** Cuántos llevas y cuántos hay. */
    count: function () { var n = 0; LIST.forEach(function (a) { if (sessionAch()[a.id]) n++; }); return { got: n, total: LIST.length }; },
    /** [actual, meta] de un logro con contador (o null). */
    progress: function (a) { return a.progress ? a.progress(context(null, 0)) : null; },

    /** Fin de una partida: suma las estadísticas, revisa todos los logros y guarda. `r` = resumen (Rules.summary con los extras de la partida); `streak` = rondas ganadas de la racha infinita.
     *  → lista de los logros desbloqueados ahora, en el orden del catálogo. */
    record: function (r, streak) {
      var st = sessionStats(), ach = sessionAch(), fresh = [];
      st.played++; st.steps += r.steps || 0; st.robbed += r.robbed || 0; st.monsters += r.monsters || 0; st.combis += r.combis || 0; st.news += r.newsRead || 0;
      if (r.won) { st.wins++; if (!r.robbed) st.safeWins++; }
      var ctx = context(r, streak);
      LIST.forEach(function (a) { if (!ach[a.id] && a.check(ctx)) { ach[a.id] = true; fresh.push(a); } });
      U.Save.persist();
      return fresh;
    },

    /** Revisa sin sumar nada (por si algún logro nuevo ya se cumple con el guardado actual). */
    sweep: function () {
      var ach = sessionAch(), ctx = context(null, 0), fresh = [];
      LIST.forEach(function (a) { if (!ach[a.id] && a.check(ctx)) { ach[a.id] = true; fresh.push(a); } });
      if (fresh.length) U.Save.persist();
      return fresh;
    }
  };
  U.Achievements = Achievements;
})();
