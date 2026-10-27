/* UrbanMex · rules — reglas del juego: economía, viaje, asaltos, Monster, fin de partida.
 * Módulo puro (sin motor). Una "partida" (run) es un objeto simple y serializable. */
(function () {
  var U = gdjs.UrbanMex, G = U.Graph, util = U.util;
  if (U.Rules) return;

  function setOf(list) { var o = {}; (list || []).forEach(function (k) { o[k] = true; }); return o; }

  var Rules = {
    createRun: function (data, levelIndex, rnd) {
      var lv = data.levels[levelIndex], cfg = data.config, rng = rnd || Math.random;
      var visited = {}; visited[lv.start] = true;
      return {
        data: data, graph: G.build(data), rnd: rng, levelIndex: levelIndex, level: lv,
        current: lv.start, stamina: lv.staminaMax, staminaMax: lv.staminaMax, money: lv.moneyStart,
        minute: cfg.dayStartMinute, steps: 0, robbed: 0, stolen: 0, visited: visited,
        blocked: setOf(lv.blocked), danger: {}, timeMods: {}, monsterPromo: false, freeRides: 0,
        newsLog: [], newsUsed: {}, unread: 0, newsTimer: cfg.news.firstDelaySec, newsCount: 0,
        over: false, won: false, endReason: ''
      };
    },

    /** Tiempo (min) de la conexión a→b contando retrasos/aceleraciones por noticias. */
    edgeCost: function (run, a, b) {
      var m = run.timeMods[G.key(a, b)];
      return m !== undefined ? m : G.baseCost(run.graph, a, b);
    },

    monsterPrice: function (run) {
      var c = run.data.config; return run.monsterPromo ? c.monsterPromoPrice : c.monsterPrice;
    },

    /** ¿Puede viajar a `to`? → { ok, reason, cost:{time,stamina,money} } */
    canTravel: function (run, to) {
      var cfg = run.data.config;
      if (run.over) return { ok: false, reason: 'over' };
      if (!G.connected(run.graph, run.current, to)) return { ok: false, reason: 'no_connection' };
      if (run.blocked[to]) return { ok: false, reason: 'blocked' };
      var cost = { time: Rules.edgeCost(run, run.current, to), stamina: cfg.staminaPerStation,
                   money: run.freeRides > 0 ? 0 : cfg.moneyPerStation };
      if (run.stamina < cost.stamina) return { ok: false, reason: 'stamina', cost: cost };
      if (run.money < cost.money) return { ok: false, reason: 'money', cost: cost };
      if (run.minute + cost.time > cfg.dayEndMinute) return { ok: false, reason: 'night', cost: cost };
      return { ok: true, cost: cost };
    },

    /** Viaja a `to`. → { ok, type: 'goal'|'shop'|'robbery'|'lucky'|'arrive', cost, stolen? } */
    travel: function (run, to) {
      var chk = Rules.canTravel(run, to);
      if (!chk.ok) return chk;
      var c = chk.cost;
      if (run.freeRides > 0) run.freeRides--;
      run.stamina -= c.stamina; run.money -= c.money; run.minute += c.time; run.steps++;
      run.current = to; run.visited[to] = true;
      var out = { ok: true, cost: c, type: 'arrive' };
      if (to === run.level.goal) {
        run.over = true; run.won = true; out.type = 'goal';
      } else if (run.data.stations[to].shop) {
        out.type = 'shop';
      } else if (run.danger[to]) {
        var r = run.data.config.robbery;
        var chance = r.baseChance - r.luck;
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

    /** Si no existe ningún movimiento posible, la partida termina (antes el juego se quedaba trabado). */
    checkStuck: function (run) {
      if (run.over) return null;
      var cfg = run.data.config, reasons = {}, any = false;
      G.neighbors(run.graph, run.current).forEach(function (n) {
        if (run.blocked[n]) return;
        var chk = Rules.canTravel(run, n);
        if (chk.ok) any = true; else reasons[chk.reason] = true;
      });
      if (any) return null;
      // En una tienda aún puede recuperarse comprando Monster
      var canRecover = run.data.stations[run.current].shop && run.stamina < run.staminaMax &&
        run.money >= Rules.monsterPrice(run) + cfg.moneyPerStation;
      if (canRecover) return null;
      run.over = true; run.won = false;
      run.endReason = reasons.night ? 'Anocheció y no llegaste a tiempo.'
        : reasons.stamina ? 'Te quedaste sin stamina.'
        : reasons.money ? 'Te quedaste sin dinero.' : 'Todas las rutas están bloqueadas.';
      return run.endReason;
    },

    /** Aplica los efectos de una noticia al estado. */
    applyNews: function (run, item) {
      var e = item.effects || {}, cfg = run.data.config;
      (e.block || []).forEach(function (s) { run.blocked[s] = true; });
      (e.danger || []).forEach(function (s) { run.danger[s] = true; });
      if (e.timeMod) {
        run.data.connections.forEach(function (c) {
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

    summary: function (run) {
      var cfg = run.data.config;
      return { won: run.won, reason: run.endReason, levelIndex: run.levelIndex, day: run.level.day,
               arrival: util.clock(run.minute), travelTime: util.duration(run.minute - cfg.dayStartMinute),
               steps: run.steps, money: run.money, robbed: run.robbed, stolen: run.stolen,
               newsRead: run.newsCount };
    },

    hasNextLevel: function (data, idx) { return idx + 1 < data.levels.length; }
  };
  U.Rules = Rules;
})();
