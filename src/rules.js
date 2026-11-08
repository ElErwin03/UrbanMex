/* UrbanMex · rules — reglas del juego: economía, viaje, asaltos, Monster, fin de partida.
 * Módulo puro (sin motor). Una "partida" (run) es un objeto simple y serializable. */
(function () {
  var U = gdjs.UrbanMex, G = U.Graph, util = U.util;
  if (U.Rules) return;

  function setOf(list) { var o = {}; (list || []).forEach(function (k) { o[k] = true; }); return o; }
  function E() { return U.Events; }

  var Rules = {
    SAVER_KEEP: 0.65,                             // 2.ª estrella: terminar con al menos el 65 % del dinero que dejaría la mejor ruta (alcanza aunque compres un Monster)
    URGENT_BELOW: 0.15,                           // apuro: queda menos del 15 % del tiempo, el dinero o la stamina (ver urgency)
    /** `level` (opcional) es un nivel ya armado (modo infinito: levelIndex -1); si no, el nivel `levelIndex` de los datos. */
    createRun: function (data, levelIndex, rnd, level) {
      var lv = level || data.levels[levelIndex], cfg = data.config, rng = rnd || Math.random;
      var visited = {}; visited[lv.start] = true;
      var run = {
        data: data, graph: G.build(data), rnd: rng, levelIndex: levelIndex, level: lv,
        current: lv.start, stamina: lv.staminaMax, staminaMax: lv.staminaMax, money: lv.moneyStart,
        minute: cfg.dayStartMinute, steps: 0, robbed: 0, stolen: 0, visited: visited,
        blocked: setOf(lv.blocked), striking: {}, eventQueue: [], danger: {}, timeMods: {}, monsterPromo: false, freeRides: 0,
        newsLog: [], newsUsed: {}, unread: 0, newsMoves: cfg.news.firstAfterMoves, newsCount: 0,
        over: false, won: false, endReason: ''
      };
      Rules.syncEvents(run);
      return run;
    },

    /** EVENTOS DEL DÍA (events.js): las estaciones de una línea en huelga cuentan como bloqueadas (run.blocked) mientras dure; run.striking guarda cuáles
     *  se cerraron por huelga (para reabrirlas sin tocar los bloqueos permanentes de nivel o noticias). Se llama cada vez que corre el reloj. */
    syncEvents: function (run) {
      var Ev = E(); if (!Ev || !(run.level.events || []).length) return;
      var now = {};
      Ev.list(run).forEach(function (e) {
        if (e.id !== 'huelga' || run.minute >= e.to) return;
        run.data.stationList.forEach(function (s) { if (s.line === e.line && s.id !== run.level.start) now[s.id] = true; });   // tu estación de salida nunca se cierra
      });
      Object.keys(run.striking).forEach(function (k) { if (!now[k]) { delete run.striking[k]; delete run.blocked[k]; } });   // reabre las que ya terminaron
      Object.keys(now).forEach(function (k) { if (!run.blocked[k]) { run.blocked[k] = true; run.striking[k] = true; } });          // cierra las nuevas (si no estaban ya bloqueadas por otra causa)
    },

    /** ¿La estación está cerrada solo por una huelga (que reabrirá)? */
    onStrike: function (run, id) { return !!run.striking[id]; },

    /** Tiempo (min) de la conexión a→b contando retrasos/aceleraciones por noticias. */
    edgeCost: function (run, a, b) {
      var m = run.timeMods[G.key(a, b)];
      return m !== undefined ? m : G.baseCost(run.graph, a, b);
    },

    monsterPrice: function (run) {
      var c = run.data.config; return run.monsterPromo ? c.monsterPromoPrice : c.monsterPrice;
    },

    /** APURO: cuánto te urge cada recurso. Con MENOS del 15 % (URGENT_BELOW) del tiempo del día, del dinero inicial o de la stamina máxima, ese
     *  recurso "aprieta": 0 = sin apuro, y sube hasta 1 cuando ya casi no queda (a 15 % vale 0, a 0 % vale 1). level = el que más aprieta.
     *  Es la ÚNICA regla del apuro: el sonido (audio.js), el borde rojo (fx.js) y el parpadeo del HUD la leen de aquí. Con la partida terminada, todo 0. */
    urgency: function (run) {
      var out = { level: 0, time: 0, money: 0, stamina: 0, any: false };
      if (!run || run.over) return out;
      var cfg = run.data.config, span = cfg.dayEndMinute - cfg.dayStartMinute, ms = run.level.moneyStart, sm = run.staminaMax, lo = Rules.URGENT_BELOW;
      var sev = function (ratio) { return ratio < lo ? util.clamp(1 - Math.max(0, ratio) / lo, 0, 1) : 0; };
      out.time = sev((cfg.dayEndMinute - run.minute) / span); out.money = ms > 0 ? sev(run.money / ms) : 0; out.stamina = sm > 0 ? sev(run.stamina / sm) : 0;
      out.level = Math.max(out.time, out.money, out.stamina); out.any = out.time > 0 || out.money > 0 || out.stamina > 0;
      return out;
    },

    /** ¿Puede viajar a `to`? → { ok, reason, cost:{time,stamina,money} } */
    canTravel: function (run, to) {
      var cfg = run.data.config;
      if (run.over) return { ok: false, reason: 'over' };
      if (!G.connected(run.graph, run.current, to)) return { ok: false, reason: 'no_connection' };
      if (run.blocked[to]) return { ok: false, reason: 'blocked' };
      var combi = G.isCombi(run.graph, run.current, to), fare = combi ? G.fare(run.graph, run.current, to) : {}, cc = cfg.combi;   // la combi cuesta más dinero que el Metro pero salta varias estaciones
      var fm = fare.money !== undefined ? fare.money : cc.money, fs = fare.stamina !== undefined ? fare.stamina : cc.stamina;
      var ex = E() ? E().hopExtra(run, combi) : { time: 0, stamina: 0 };                            // lluvia / hora pico: tramos más lentos y cansados
      var cost = { time: Rules.edgeCost(run, run.current, to) + ex.time, stamina: (combi ? fs : cfg.staminaPerStation) + ex.stamina,
                   money: run.freeRides > 0 ? 0 : (combi ? fm : cfg.moneyPerStation), combi: combi, event: ex };
      if (run.stamina < cost.stamina) return { ok: false, reason: 'stamina', cost: cost };
      if (run.money < cost.money) return { ok: false, reason: 'money', cost: cost };
      if (run.minute + cost.time > cfg.dayEndMinute) return { ok: false, reason: 'night', cost: cost };
      return { ok: true, cost: cost };
    },

    /** Explica POR QUÉ no se puede viajar a `to` (null si sí se puede): { code, short, detail, missing }.
     *  short = frase corta ("Te faltan 15 de stamina"); detail = qué hacer, de una sola línea (máx. 62 caracteres, cabe en el panel);
     *  missing = cuánto falta de lo que impide el viaje (stamina, dinero o minutos). Todo con los números reales de la partida. */
    explain: function (run, to) {
      var chk = Rules.canTravel(run, to); if (chk.ok) return null;
      var cfg = run.data.config, c = chk.cost || {}, cur = cfg.currencyName || 'monedas', out = { code: chk.reason, missing: 0 };
      if (chk.reason === 'stamina') {
        out.missing = Math.ceil(c.stamina - run.stamina); out.short = 'Te faltan ' + out.missing + ' de stamina';
        var sHave = Math.floor(run.stamina);
        out.detail = c.combi ? 'La combi gasta ' + c.stamina + ' de stamina y tienes ' + sHave + (sHave >= cfg.staminaPerStation ? '. Mejor el Metro.' : '.')
                             : 'Cuesta ' + c.stamina + ' y tienes ' + sHave + '. Compra un Monster en una tienda.';
      } else if (chk.reason === 'money') {
        out.missing = Math.ceil(c.money - run.money); out.short = 'Te faltan ' + out.missing + ' ' + cur;
        var mHave = Math.floor(run.money);
        out.detail = c.combi ? 'La combi cuesta ' + c.money + ' y tienes ' + mHave + (mHave >= cfg.moneyPerStation ? '. El Metro cuesta ' + cfg.moneyPerStation + '.' : '.')
                             : 'Cada estacion cuesta ' + c.money + ' y tienes ' + mHave + '.';
      } else if (chk.reason === 'night') {
        var left = Math.max(0, cfg.dayEndMinute - run.minute); out.missing = Math.ceil(c.time - left); out.short = 'Ya no llegas a tiempo';
        out.detail = 'El viaje dura ' + c.time + ' min y solo quedan ' + left + ' min del dia.';
      } else if (chk.reason === 'blocked') {
        var sk = Rules.onStrike(run, to) ? E().strikeAt(run, to) : null;
        if (sk) { out.short = 'Huelga en la linea ' + sk.line; out.detail = 'Reabre a las ' + util.clock(sk.to) + '. Busca otra ruta o espera.'; out.until = sk.to; }
        else { out.short = 'Estacion bloqueada'; out.detail = 'Hay un bloqueo ahi. Busca otra ruta o revisa las noticias.'; }
      } else if (chk.reason === 'no_connection') {
        out.short = 'Sin ruta directa'; out.detail = 'Solo puedes viajar a estaciones conectadas a la actual.';
      } else { out.short = 'Partida terminada'; out.detail = ''; }
      return out;
    },

    /** Viaja a `to`. → { ok, type: 'goal'|'shop'|'robbery'|'lucky'|'arrive', cost, stolen? } */
    travel: function (run, to) {
      var chk = Rules.canTravel(run, to);
      if (!chk.ok) return chk;
      var c = chk.cost;
      if (run.freeRides > 0) run.freeRides--;
      var prev = run.minute, bonus = E() ? E().robberyBonus(run) : 0;                              // el riesgo de asalto es el de la hora en que sales
      run.stamina -= c.stamina; run.money -= c.money; run.minute += c.time; run.steps++;
      if (E()) { E().transitions(run, prev, run.minute).forEach(function (t) { run.eventQueue.push(t); }); Rules.syncEvents(run); }
      run.current = to; run.visited[to] = true;
      var out = { ok: true, cost: c, type: 'arrive' };
      if (to === run.level.goal) {
        run.over = true; run.won = true; out.type = 'goal';
      } else if (run.data.stations[to].shop) {
        out.type = 'shop';
      } else if (run.danger[to]) {
        var r = run.data.config.robbery;
        var chance = Math.min(0.95, r.baseChance - r.luck + bonus);
        if (run.rnd() < chance) {
          var loss = Math.min(run.money, Math.floor(r.minLoss + run.rnd() * (r.maxLoss - r.minLoss + 1)));
          run.money -= loss; run.stolen += loss; run.robbed++;
          out.type = 'robbery'; out.stolen = loss;
        } else out.type = 'lucky';
      }
      return out;
    },

    /** Compra un Monster (solo si hay dinero y la stamina no está llena). */
    buyMonster: function (run) {
      var price = Rules.monsterPrice(run), cfg = run.data.config;
      if (run.stamina >= run.staminaMax) return { ok: false, reason: 'full' };
      if (run.money < price) return { ok: false, reason: 'money' };
      var before = run.stamina;
      run.money -= price; run.stamina = Math.min(run.staminaMax, run.stamina + cfg.monsterStamina);
      return { ok: true, gained: run.stamina - before, price: price };
    },

    /** ESPERAR: el reloj avanza hasta que reabra la línea en huelga que primero lo haga (o hasta `untils`, una lista de horas). Cuesta solo tiempo.
     *  → { ok, from, to } o { ok:false, reason: 'over' | 'none' | 'night' } (no hay huelga, o reabre después de que acabe el día). */
    wait: function (run, untils) {
      if (run.over) return { ok: false, reason: 'over' };
      var ends = untils || (E() ? E().strikeEnds(run) : []);
      if (!ends.length) return { ok: false, reason: 'none' };
      var to = Math.min.apply(null, ends), from = run.minute;
      if (to > run.data.config.dayEndMinute) return { ok: false, reason: 'night' };
      run.minute = to; run.waited = (run.waited || 0) + (to - from);
      E().transitions(run, from, to).forEach(function (t) { run.eventQueue.push(t); });
      run.eventQueue.push({ id: 'huelga', kind: 'wait', from: from, to: to });
      Rules.syncEvents(run);
      return { ok: true, from: from, to: to };
    },

    /** Si no existe ningún movimiento posible, la partida termina (antes el juego se quedaba trabado). */
    checkStuck: function (run) {
      if (run.over) return null;
      var cfg = run.data.config, reasons = {}, any = false, strikes = [];
      G.neighbors(run.graph, run.current).forEach(function (n) {
        if (run.blocked[n]) { if (run.striking[n]) strikes.push(E().strikeAt(run, n).to); return; }
        var chk = Rules.canTravel(run, n);
        if (chk.ok) any = true; else reasons[chk.reason] = true;
      });
      if (any) return null;
      // En una tienda aún puede recuperarse comprando Monster
      var canRecover = run.data.stations[run.current].shop && run.stamina < run.staminaMax &&
        run.money >= Rules.monsterPrice(run) + cfg.moneyPerStation;
      if (canRecover) return null;
      // Solo te frena una huelga: esperas (el reloj avanza) a que reabra la línea; si ni así llegas, el día termina como siempre
      if (strikes.length && Rules.wait(run, strikes).ok) return Rules.checkStuck(run);
      run.over = true; run.won = false;
      run.endCause = reasons.night ? 'night' : reasons.stamina ? 'stamina' : reasons.money ? 'money' : 'blocked';
      run.endReason = { night: 'Anocheció y no llegaste a tiempo.', stamina: 'Te quedaste sin stamina.', money: 'Te quedaste sin dinero.', blocked: 'Todas las rutas están bloqueadas.' }[run.endCause];
      return run.endReason;
    },

    /** Aplica los efectos de una noticia al estado. */
    applyNews: function (run, item) {
      var e = item.effects || {}, cfg = run.data.config;
      (e.block || []).forEach(function (s) { run.blocked[s] = true; delete run.striking[s]; });   // un bloqueo de noticia es permanente aunque la huelga termine
      (e.danger || []).forEach(function (s) { run.danger[s] = true; });
      if (e.timeMod) {
        run.data.connections.forEach(function (c) {
          if (c.combi) return;                                                     // las combis no usan las líneas del Metro: no les afectan sus fallas
          var la = run.data.stations[c.a].line, lb = run.data.stations[c.b].line;
          if (la === e.timeMod.line || lb === e.timeMod.line) {
            var k = G.key(c.a, c.b), cur = run.timeMods[k] !== undefined ? run.timeMods[k] : c.cost;
            run.timeMods[k] = Math.max(cfg.minEdgeTime, cur + e.timeMod.extra);
          }
        });
      }
      if (e.staminaPenalty) run.stamina = Math.max(0, run.stamina - e.staminaPenalty);
      if (e.monsterPromo) run.monsterPromo = true;
      if (e.freeRide) run.freeRides += e.freeRide;
    },

    /** Lo que más dinero te dejaría la mejor ruta (sin noticias ni asaltos): dinero inicial − el tramo más barato de salida a meta. null si no hay ruta. */
    parMoney: function (run) {
      var cfg = run.data.config, lv = run.level, blocked = setOf(lv.blocked), dist = {}, done = {};
      dist[lv.start] = 0;
      for (;;) {
        var u = null; Object.keys(dist).forEach(function (k) { if (!done[k] && (u === null || dist[k] < dist[u])) u = k; });
        if (u === null) return null;
        if (u === lv.goal) return lv.moneyStart - dist[u];
        done[u] = true;
        G.neighbors(run.graph, u).forEach(function (v) {
          if (blocked[v] || done[v]) return;
          var combi = G.isCombi(run.graph, u, v), fare = combi ? G.fare(run.graph, u, v) : {};
          var w = dist[u] + (combi ? (fare.money !== undefined ? fare.money : cfg.combi.money) : cfg.moneyPerStation);
          if (dist[v] === undefined || w < dist[v]) dist[v] = w;
        });
      }
    },

    /** Estaciones que faltan de `from` a la meta (por el camino más corto sin bloqueos; si no hay, ignorando los bloqueos de noticias). */
    hopsLeft: function (run, from, ignoreNews) {
      var p = G.shortestPath(run.graph, from, run.level.goal, ignoreNews ? setOf(run.level.blocked) : run.blocked);
      return p ? p.length - 1 : null;
    },

    /** Estrellas de la jornada (solo si ganaste): 1) llegar, 2) ahorrar (terminar con al menos SAVER_KEEP de lo que dejaría la mejor ruta), 3) sin asaltos. */
    score: function (run) {
      var par = Rules.parMoney(run), goal = par === null ? 0 : Math.ceil(par * Rules.SAVER_KEEP), won = !!run.won;
      var st = { arrive: won, saver: won && run.money >= goal, safe: won && run.robbed === 0 };
      return { stars: (st.arrive ? 1 : 0) + (st.saver ? 1 : 0) + (st.safe ? 1 : 0), got: st, moneyGoal: goal, moneyPar: par };
    },

    summary: function (run) {
      var cfg = run.data.config, sc = Rules.score(run), total = Rules.hopsLeft({ graph: run.graph, level: run.level, blocked: {} }, run.level.start, true);
      var left = run.won ? 0 : Rules.hopsLeft(run, run.current);
      if (left === null) left = Rules.hopsLeft(run, run.current, true);
      return { won: run.won, reason: run.endReason, cause: run.endCause || '', levelIndex: run.levelIndex, day: run.level.day, infinite: run.level.infinite ? { round: run.level.round } : null,
               arrival: util.clock(run.minute), travelTime: util.duration(run.minute - cfg.dayStartMinute),
               steps: run.steps, money: run.money, robbed: run.robbed, stolen: run.stolen,
               newsRead: run.newsCount, moneyStart: run.level.moneyStart, currency: cfg.currencyName || 'monedas',
               stars: sc.stars, got: sc.got, moneyGoal: sc.moneyGoal,
               hops: total || 0, left: left === null ? null : left,                 // estaciones del camino más corto y las que te faltaban al terminar
               progress: total && left !== null ? Math.max(0, Math.min(1, 1 - left / total)) : 0 };
    },

    hasNextLevel: function (data, idx) { return idx + 1 < data.levels.length; }
  };
  U.Rules = Rules;
})();
