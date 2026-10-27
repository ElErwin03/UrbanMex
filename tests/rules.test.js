const test = require('node:test'), assert = require('node:assert');
const { loadModules, rawData } = require('./helpers');
const U = loadModules(['core', 'data', 'graph', 'rules', 'news']);
const data = U.Data.normalize(rawData());

/** Bot: sigue el camino más corto, compra Monster cuando le falta stamina para lo que resta. */
function playBot(levelIndex, seed, withNews) {
  const rnd = U.util.seeded(seed), run = U.Rules.createRun(data, levelIndex, rnd);
  U.News.intro(run);
  let guard = 500;
  while (!run.over && guard--) {
    if (withNews) { U.News.tick(run, 4); }
    const path = U.Graph.shortestPath(run.graph, run.current, run.level.goal, run.blocked);
    assert.ok(path, 'la meta debe seguir siendo alcanzable (nivel ' + (levelIndex + 1) + ', semilla ' + seed + ')');
    const next = path[1], need = (path.length - 1) * data.config.staminaPerStation;
    const shop = data.stations[run.current].shop;
    if (shop && run.stamina < need) while (U.Rules.buyMonster(run).ok && run.stamina < need) {}
    const out = U.Rules.travel(run, next);
    if (!out.ok) { U.Rules.checkStuck(run); if (!run.over) { run.over = true; run.endReason = 'bot: ' + out.reason; } }
    else if (out.type !== 'goal') U.Rules.checkStuck(run);
  }
  return run;
}

test('los datos se normalizan y son coherentes', () => {
  assert.equal(data.stationList.length, 83);
  assert.equal(data.connections.length, 89);
  const pos = {};
  data.stationList.forEach((s) => { const k = s.x + ',' + s.y; assert.ok(!pos[k], 'estaciones encimadas: ' + s.id + ' / ' + pos[k]); pos[k] = s.id; });
  data.news.forEach((n) => ['danger', 'block'].forEach((k) => ((n.effects || {})[k] || []).forEach((s) => assert.ok(data.stations[s], n.id + ' → ' + s))));
});

test('los 5 niveles tienen meta alcanzable', () => {
  data.levels.forEach((lv, i) => {
    const run = U.Rules.createRun(data, i);
    assert.ok(U.Graph.reachable(run.graph, lv.start, lv.goal, run.blocked), 'nivel ' + lv.id);
  });
});

test('cada nivel se gana jugando bien, sin noticias', () => {
  data.levels.forEach((lv, i) => { const r = playBot(i, 1, false); assert.ok(r.won, 'nivel ' + lv.id + ': ' + r.endReason); });
});

test('con noticias aleatorias la meta nunca queda inalcanzable (500 partidas por nivel)', () => {
  let wins = 0, total = 0;
  data.levels.forEach((lv, i) => {
    for (let s = 1; s <= 500; s++) { const r = playBot(i, s * 7919 + i, true); total++; if (r.won) wins++; }
  });
  console.log('   victorias del bot con noticias y asaltos: ' + wins + '/' + total + ' (' + Math.round((100 * wins) / total) + '%)');
  assert.ok(wins / total > 0.5, 'el juego debería ser ganable con frecuencia');
});

test('viajar cobra tiempo, stamina y dinero y respeta bloqueos', () => {
  const run = U.Rules.createRun(data, 1);              // Martes: Juárez bloqueada
  assert.equal(U.Rules.canTravel(run, 'Juárez').reason, 'no_connection');
  const n = data.connections.find((c) => c.a === run.current || c.b === run.current);
  const to = n.a === run.current ? n.b : n.a, s0 = run.stamina, m0 = run.money, t0 = run.minute;
  const out = U.Rules.travel(run, to);
  assert.ok(out.ok);
  assert.equal(run.stamina, s0 - data.config.staminaPerStation);
  assert.equal(run.money, m0 - data.config.moneyPerStation);
  assert.equal(run.minute, t0 + n.cost);
  run.blocked[run.current === to ? 'x' : 'Tlatelolco'] = true;
  assert.equal(U.Rules.canTravel(run, 'Tlatelolco').reason, run.graph.adj[run.current].includes('Tlatelolco') ? 'blocked' : 'no_connection');
});

test('noticia "metro gratis": el siguiente viaje no cuesta dinero (antes no tenía efecto)', () => {
  const run = U.Rules.createRun(data, 0), free = data.news.find((n) => n.effects.freeRide);
  assert.ok(free); U.News.trigger(run, free);
  const m0 = run.money, to = run.graph.adj[run.current][0];
  U.Rules.travel(run, to);
  assert.equal(run.money, m0);
  assert.equal(run.freeRides, 0);
});

test('Monster: +stamina, cuesta dinero, no se compra con stamina llena', () => {
  const run = U.Rules.createRun(data, 1);
  assert.equal(U.Rules.buyMonster(run).reason, 'full');
  run.stamina = 20; const m0 = run.money;
  const r = U.Rules.buyMonster(run);
  assert.ok(r.ok); assert.equal(run.stamina, 20 + data.config.monsterStamina); assert.equal(run.money, m0 - data.config.monsterPrice);
});

test('partida atascada (sin dinero) termina en vez de trabarse', () => {
  const run = U.Rules.createRun(data, 0); run.money = 0;
  assert.equal(U.Rules.checkStuck(run), 'Te quedaste sin dinero.');
  assert.ok(run.over && !run.won);
});

test('anochece: el tiempo límite termina la partida', () => {
  const run = U.Rules.createRun(data, 0); run.minute = data.config.dayEndMinute - 1;
  assert.equal(U.Rules.checkStuck(run), 'Anocheció y no llegaste a tiempo.');
});

test('asaltos solo ocurren en estaciones marcadas como peligrosas', () => {
  const run = U.Rules.createRun(data, 0, () => 0);     // rnd=0 → siempre asalta si hay peligro
  const to = run.graph.adj[run.current][0];
  run.danger[to] = true; const out = U.Rules.travel(run, to);
  assert.ok(['robbery', 'shop', 'goal'].includes(out.type));
  const run2 = U.Rules.createRun(data, 0, () => 0); assert.equal(U.Rules.travel(run2, run2.graph.adj[run2.current][0]).type === 'robbery', false);
});
