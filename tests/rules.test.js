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
  assert.equal(data.connections.filter((c) => !c.combi).length, 89);                 // Metro
  assert.equal(data.connections.filter((c) => c.combi).length, 8);                    // rutas de combi
  data.connections.filter((c) => c.combi).forEach((c) => assert.ok(!c.transfer, 'una combi no es un transbordo: ' + c.a + ' - ' + c.b));
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

test('tiendas: hay 3 nuevas estratégicas y cada jornada tiene al menos 3 tiendas junto a su ruta más corta', () => {
  const shops = data.stationList.filter((s) => s.shop).map((s) => s.id);
  assert.equal(shops.length, 10);
  ['Balderas', 'San Antonio Abad', 'Guerrero'].forEach((n) => assert.ok(shops.includes(n), 'falta la tienda en ' + n));
  const adj = {}; data.connections.forEach((c) => { (adj[c.a] = adj[c.a] || []).push(c.b); (adj[c.b] = adj[c.b] || []).push(c.a); });
  const bfs = (src) => { const d = { [src]: 0 }, q = [src]; while (q.length) { const u = q.shift(); adj[u].forEach((v) => { if (!(v in d)) { d[v] = d[u] + 1; q.push(v); } }); } return d; };
  data.levels.forEach((lv) => {
    const a = bfs(lv.start), b = bfs(lv.goal), n = a[lv.goal];
    const near = shops.filter((s) => !lv.blocked.includes(s) && a[s] + b[s] - n <= 2);
    assert.ok(near.length >= 3, `día ${lv.id}: solo ${near.length} tiendas junto a la ruta (${near.join(', ')})`);
  });
});

test('textos: toda mención de una línea dice su color y los bloqueos aclaran que solo se cierra esa estación', () => {
  const lines = data.lines;
  data.news.forEach((n) => ['title', 'desc', 'impact'].forEach((f) => {
    for (const m of n[f].matchAll(/L[ÍI]NEA ([1235B])\b/gi)) assert.ok(new RegExp(lines[m[1]].colorName, 'i').test(n[f]), `${n.id}.${f} menciona la línea ${m[1]} sin su color: ${n[f]}`);
  }));
  data.news.filter((n) => n.effects.block).forEach((n) => assert.ok(/^Solo .* est[aá] cerrada/i.test(n.impact), n.id + ' debe aclarar que solo se cierra esa estación'));
});

test('combi: cuesta más dinero que el Metro, no la afectan las fallas de línea y salta varias estaciones', () => {
  const run = U.Rules.createRun(data, 0, U.util.seeded(3)), cfg = data.config;
  const combi = data.connections.find((c) => c.a === 'Balderas' && c.b === 'Zócalo');
  assert.ok(combi && combi.combi);
  run.current = 'Balderas'; const chk = U.Rules.canTravel(run, 'Zócalo');
  assert.ok(chk.ok); assert.equal(chk.cost.money, cfg.combi.money); assert.equal(chk.cost.stamina, cfg.combi.stamina); assert.equal(chk.cost.time, combi.cost); assert.equal(chk.cost.combi, true);
  assert.ok(cfg.combi.money > cfg.moneyPerStation, 'la combi debe costar más que un tramo de Metro');
  const metro = U.Rules.canTravel(run, data.connections.find((c) => c.a === 'Balderas' && !c.combi).b); assert.equal(metro.cost.money, cfg.moneyPerStation); assert.ok(!metro.cost.combi);
  // una falla en la línea 2 (Zócalo es de la línea 2) retrasa el Metro pero no la combi
  U.Rules.applyNews(run, data.news.find((n) => n.id === 'n17'));
  assert.equal(U.Rules.edgeCost(run, 'Balderas', 'Zócalo'), combi.cost);
  const t0 = run.minute, m0 = run.money; assert.ok(U.Rules.travel(run, 'Zócalo').ok);
  assert.equal(run.minute - t0, combi.cost); assert.equal(m0 - run.money, cfg.combi.money);
});

test('ruta automática: usa la combi si conviene, evita bloqueos y zonas peligrosas', () => {
  const run = U.Rules.createRun(data, 0, U.util.seeded(3));
  run.current = 'Balderas';
  assert.deepEqual(U.Rules.planRoute(run, 'Zócalo'), ['Balderas', 'Zócalo']);        // 8 min en combi contra ~25 en Metro
  const far = U.Rules.planRoute(run, 'Pantitlán'); assert.equal(far[0], 'Balderas'); assert.equal(far[far.length - 1], 'Pantitlán');
  for (let i = 1; i < far.length; i++) assert.ok(U.Graph.connected(run.graph, far[i - 1], far[i]), 'tramo inexistente ' + far[i - 1] + ' → ' + far[i]);
  assert.equal(U.Rules.planRoute(run, 'Balderas').length, 1);                          // ya estás ahí
  const mid = far[Math.floor(far.length / 2)]; run.blocked[mid] = true;
  const detour = U.Rules.planRoute(run, 'Pantitlán'); assert.ok(!detour || !detour.includes(mid), 'no debe pasar por una estación bloqueada');
  assert.equal(U.Rules.planRoute(run, mid), null);                                     // la meta bloqueada no tiene ruta
});
