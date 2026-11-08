/* UrbanMex · infinite — MODO INFINITO (puro, sin motor). Se desbloquea al completar los 10 niveles.
 * Cada RONDA es una ruta al azar (salida, meta, bloqueos y eventos del día) que se generan a partir de una semilla y del número de ronda:
 * la misma semilla y ronda dan siempre el mismo nivel. Cada ronda se comprueba antes de jugarse: un jugador automático la termina de verdad
 * con las reglas del juego (si no, se descarta y se prueba otra). El dinero y la stamina salen de la ruta, con el mismo balance que los niveles
 * hechos a mano: como máximo 1 Monster obligatorio, para que la estrella de ahorro siempre sea posible.
 * La racha termina al perder una ronda; se guarda la mejor racha (rondas y estrellas). */
(function () {
  var U = gdjs.UrbanMex, util = U.util, G = U.Graph;
  if (U.Infinite) return;

  var TUNE = {
    attempts: 60,                                  // intentos por ronda antes de usar un nivel de respaldo
    hopsLow: 8, hopsHigh: 14, hopsGrow: 10,        // tramos de la ruta más corta: 8-14 en la ronda 1, subiendo hasta 18-34 en la ronda 11
    blocksEvery: 3, blocksMax: 3,                  // un bloqueo más cada 3 rondas (0 en las rondas 1-2)
    eventsEvery: 3,                                // un evento más cada 3 rondas (1 al inicio, 3 desde la ronda 7)
    parWithMonster: 100, parNoMonster: 85,         // dinero que sobra con la ruta más barata (≥ 86 con Monster: la estrella de ahorro cabe aunque lo compres)
    monsterSlack: 32,                              // la ruta puede pedir hasta esto más que la stamina máxima (un Monster da 40)
    staminaFloor: 60, staminaCap: 120
  };
  var FALLBACK_START = 0;

  /** Nombre para mostrar: sin el sufijo de línea de las estaciones repetidas ("Hidalgo L3" → "Hidalgo"). */
  function nice(id) { return id.replace(/\s+L(?:B2?|\d)$/, ''); }
  function mix(seed, round) { return ((seed * 2654435761) ^ (round * 40503 + 977)) >>> 0; }
  function ceil5(n) { return Math.ceil(n / 5) * 5; }
  function shuffle(rnd, arr) { var a = arr.slice(), i, j, t; for (i = a.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function setOf(list) { var o = {}; (list || []).forEach(function (k) { o[k] = true; }); return o; }

  /** Tramos desde `start` a cada estación (sin bloqueos). */
  function hopsFrom(graph, start) {
    var dist = {}, q = [start], i = 0; dist[start] = 0;
    while (i < q.length) { var u = q[i++]; G.neighbors(graph, u).forEach(function (v) { if (dist[v] === undefined) { dist[v] = dist[u] + 1; q.push(v); } }); }
    return dist;
  }

  /** Ruta que menos stamina gasta (con los eventos de la hora de cada salida). → { path, need } o null. Es lo que usa el jugador automático. */
  function cheapestPath(run) {
    var cfg = run.data.config, dist = {}, prev = {}, done = {}; dist[run.current] = 0;
    for (;;) {
      var u = null; Object.keys(dist).forEach(function (k) { if (!done[k] && (u === null || dist[k] < dist[u])) u = k; });
      if (u === null) return null;
      if (u === run.level.goal) break;
      done[u] = true;
      G.neighbors(run.graph, u).forEach(function (v) {
        if (run.blocked[v] || done[v]) return;
        var fare = G.isCombi(run.graph, u, v) ? G.fare(run.graph, u, v) : null;
        var w = dist[u] + (fare ? (fare.stamina !== undefined ? fare.stamina : cfg.combi.stamina) : cfg.staminaPerStation) + 0.001;   // el 0.001 desempata a favor de menos tramos
        if (dist[v] === undefined || w < dist[v]) { dist[v] = w; prev[v] = u; }
      });
    }
    var path = [run.level.goal]; while (prev[path[0]] !== undefined) path.unshift(prev[path[0]]);
    var need = Math.round(dist[run.level.goal]), sim = { data: run.data, level: run.level, minute: run.minute };
    for (var k = 0; k + 1 < path.length; k++) {
      var combi = G.isCombi(run.graph, path[k], path[k + 1]), ex = U.Events.hopExtra(sim, combi);
      need += ex.stamina; sim.minute += U.Rules.edgeCost(run, path[k], path[k + 1]) + ex.time;
    }
    return { path: path, need: need };
  }

  /** ¿Conviene esperar a que reabra una línea en huelga? Sí si no hay ruta, o si con la línea abierta se ahorrarían 20+ de stamina. */
  function wantsWait(run) {
    var ends = U.Events.strikeEnds(run); if (!ends.length) return false;
    var now = cheapestPath(run); if (!now) return true;
    var later = Object.assign({}, run, { minute: Math.min.apply(null, ends), blocked: Object.assign({}, run.blocked), striking: Object.assign({}, run.striking), eventQueue: [] });
    U.Rules.syncEvents(later); var lp = cheapestPath(later);
    return !!lp && now.need - lp.need >= 20 && Math.min.apply(null, ends) <= run.data.config.dayEndMinute - 240;
  }

  /** Jugador automático (sin noticias ni asaltos): ¿se puede ganar esta ronda con las reglas reales? → { won, money, minute, monsters }. */
  function autoplay(data, lv) {
    var R = U.Rules, run = R.createRun(data, -1, function () { return 0.99; }, lv), monsters = 0;
    for (var guard = 600; guard-- > 0 && !run.over;) {
      if (wantsWait(run) && R.wait(run).ok) continue;
      var bp = cheapestPath(run);
      if (!bp) { if (R.wait(run).ok) continue; break; }
      if (data.stations[run.current].shop && run.stamina < bp.need) { while (run.stamina < bp.need && R.buyMonster(run).ok) monsters++; }
      var out = R.travel(run, bp.path[1]);
      if (!out.ok) break;
      R.checkStuck(run);
    }
    return { won: !!run.won, money: run.money, minute: run.minute, monsters: monsters };
  }

  var Infinite = {
    TUNE: TUNE, nice: nice, cheapestPath: cheapestPath, wantsWait: wantsWait, autoplay: autoplay,

    /** ¿Ya completaste los `total` niveles? (desbloquea el modo infinito) */
    unlocked: function (total) { if (!total) return false; for (var i = 0; i < total; i++) if (!U.Save.isCompleted(i)) return false; return true; },

    /** Qué tan difícil es una ronda: tramos de la ruta, bloqueos y eventos. */
    difficulty: function (round) {
      var g = Math.min(Math.max(round - 1, 0), TUNE.hopsGrow);
      return { hopsLow: TUNE.hopsLow + g, hopsHigh: TUNE.hopsHigh + 2 * g, blocks: Math.min(TUNE.blocksMax, Math.floor(round / TUNE.blocksEvery)), events: Math.min(3, 1 + Math.floor((round - 1) / TUNE.eventsEvery)) };
    },

    /** Título corto para pantallas: "RONDA 3" en el modo infinito, "NIVEL 6 - LUNES 2" en los niveles. */
    title: function (lv) { return lv.infinite ? 'RONDA ' + lv.round : 'NIVEL ' + lv.id + ' - ' + lv.day; },

    /** Nueva racha: semilla al azar, ronda 1. */
    start: function (seed) { U.session.infinite = { seed: seed || Math.floor(Math.random() * 999999) + 1, round: 1, cleared: 0, stars: 0, newBest: false }; return U.session.infinite; },

    /** Fin de una ronda (se llama una vez): si ganaste, suma la ronda y las estrellas a la racha y guarda el récord. → resumen de la racha para la pantalla de resultado. */
    finish: function (run, stars) {
      var s = U.session.infinite; if (!s) return null;
      if (run.won) { s.cleared = s.round; s.stars += stars; s.newBest = U.Save.recordStreak(s.cleared, s.stars).isNew; }
      return { round: s.round, cleared: s.cleared, stars: s.stars, newBest: !!s.newBest && s.cleared > 0, best: { best: U.session.inf.best, stars: U.session.inf.stars } };
    },

    /** El nivel de la ronda `round` de la racha con esa semilla (siempre el mismo y siempre ganable). */
    level: function (data, seed, round) {
      var rnd = util.seeded(mix(seed, round)), diff = Infinite.difficulty(round), graph = G.build(data), ids = data.stationList.map(function (s) { return s.id; });
      for (var attempt = 0; attempt < TUNE.attempts; attempt++) {
        var lv = draft(data, graph, ids, rnd, diff, round, attempt);
        if (lv && autoplay(data, lv).won) return lv;
      }
      return fallback(data, round);                // no debería pasar: un nivel hecho a mano (siempre ganable) con la etiqueta de la ronda
    }
  };

  /** Un candidato de ronda: ruta, bloqueos, eventos y recursos (todavía sin comprobar que se gana). */
  function draft(data, graph, ids, rnd, diff, round, attempt) {
    var cfg = data.config, relax = Math.floor(attempt / 20);                      // si no hay metas con ese largo, se afloja la exigencia
    var start = util.pick(rnd, ids), dist = hopsFrom(graph, start);
    var goals = ids.filter(function (id) { return id !== start && dist[id] >= diff.hopsLow - 3 * relax && dist[id] <= diff.hopsHigh + 3 * relax; });
    if (!goals.length) return null;
    var goal = util.pick(rnd, goals), blocked = [], path = G.shortestPath(graph, start, goal, {});
    if (!path) return null;
    var interior = shuffle(rnd, path.slice(1, -1));                                 // los bloqueos caen sobre el camino más corto: obligan a rodear
    for (var i = 0; i < interior.length && blocked.length < diff.blocks; i++) {
      var tryBlocked = setOf(blocked.concat(interior[i])); if (G.reachable(graph, start, goal, tryBlocked)) blocked.push(interior[i]);
    }
    var lv = { id: round, day: 'RONDA ' + round, infinite: true, round: round, start: start, goal: goal, blocked: blocked, events: [], moneyStart: 0, staminaMax: 0 };
    lv.startDesc = 'Sales de ' + nice(start) + '. Hoy te toca una ruta nueva.'; lv.goalDesc = 'Llegaste a ' + nice(goal) + '!';
    // eventos del día: se eligen al azar y se descartan los que dejarían la meta sin ruta mientras están en marcha
    var lineIds = Object.keys(data.lines), goalLine = data.stations[goal].line;
    shuffle(rnd, ['horaPico', 'lluvia', 'huelga']).slice(0, diff.events).forEach(function (id) {
      if (id === 'horaPico') lv.events.push({ id: 'horaPico' });
      else if (id === 'lluvia') { var from = 480 + 30 * Math.floor(rnd() * 3); lv.events.push({ id: 'lluvia', from: from, to: from + 120 + 30 * Math.floor(rnd() * 3) }); }
      else {
        var cands = shuffle(rnd, lineIds.filter(function (l) { return l !== goalLine; })), until = 510 + 30 * Math.floor(rnd() * 5);
        for (var c = 0; c < cands.length; c++) {
          var closed = setOf(blocked); data.stationList.forEach(function (s) { if (s.line === cands[c] && s.id !== start) closed[s.id] = true; });
          if (G.reachable(graph, start, goal, closed)) { lv.events.push({ id: 'huelga', line: cands[c], until: until }); break; }
        }
      }
    });
    try { U.Events.validate(cfg, data.lines, lv); } catch (e) { return null; }
    // recursos: dinero para la ruta más barata más el margen, y stamina para que pida a lo sumo 1 Monster (la ruta se mide con la huelga ya terminada: lo mejor que puede pasar)
    var R = U.Rules, probe = R.createRun(data, -1, function () { return 0.99; }, Object.assign({}, lv, { moneyStart: 0, staminaMax: 100 }));
    var cost = -R.parMoney(probe), open = Object.assign({}, probe, { blocked: setOf(blocked), striking: {} }), plan = cheapestPath(open), now = cheapestPath(probe);
    if (!plan || !now || cost !== cost) return null;
    var need = Math.min(plan.need, now.need), floor = Math.max(TUNE.staminaFloor, ceil5(need - TUNE.monsterSlack));
    lv.staminaMax = Math.min(TUNE.staminaCap, Math.max(floor, ceil5(need * util.range(rnd, 0.8, 1.0))));
    if (need - lv.staminaMax > TUNE.monsterSlack) return null;
    var monsters = need > lv.staminaMax ? 1 : 0;
    lv.moneyStart = cost + (monsters ? TUNE.parWithMonster : TUNE.parNoMonster) + 5 * Math.floor(rnd() * 3);
    return lv;
  }

  function fallback(data, round) {
    var base = data.levels[(round - 1 + FALLBACK_START) % data.levels.length];
    return Object.assign({}, JSON.parse(JSON.stringify(base)), { id: round, day: 'RONDA ' + round, infinite: true, round: round });
  }

  U.Infinite = Infinite;
})();
