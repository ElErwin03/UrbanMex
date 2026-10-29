const test = require('node:test'), assert = require('node:assert');
const { loadModules, rawData, cheapestStaminaPath } = require('./helpers');
const U = loadModules(['core', 'data', 'graph', 'rules', 'news']);
const data = U.Data.normalize(rawData());

/** Bot: sigue el camino más corto, compra Monster cuando le falta stamina para lo que resta. */
function playBot(levelIndex, seed, withNews) {
  const rnd = U.util.seeded(seed), run = U.Rules.createRun(data, levelIndex, rnd);
  U.News.intro(run);
  let guard = 500;
  while (!run.over && guard--) {
    if (withNews) { U.News.onMove(run); }                       // las noticias llegan al moverse
    const bp = cheapestStaminaPath(U, run), path = bp && bp.path;
    assert.ok(path, 'la meta debe seguir siendo alcanzable (nivel ' + (levelIndex + 1) + ', semilla ' + seed + ')');
    const next = path[1], need = bp.need;
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
  assert.equal(data.connections.filter((c) => c.combi).length, 9);                    // rutas de combi
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

test('progreso guardado: JUGAR va al primer nivel sin completar y el guardado sobrevive a reiniciar', () => {
  const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  try {
    const S = U.session, total = 5;
    S.completed = []; S.loaded = true; S.seenTutorial = false; S.dblTravel = true;
    assert.equal(U.Save.nextLevel(total), 0);
    U.Save.markCompleted(0); U.Save.markCompleted(1); U.Save.markCompleted(1);            // repetir no duplica
    assert.deepEqual(JSON.parse(store[U.Save.KEY]).completed, [0, 1]);
    assert.equal(U.Save.nextLevel(total), 2);
    U.Save.markCompleted(3);                                                                // aunque haya uno posterior, JUGAR va al primero pendiente
    assert.equal(U.Save.nextLevel(total), 2);
    [2, 4].forEach((i) => U.Save.markCompleted(i)); assert.equal(U.Save.nextLevel(total), total - 1);   // todo completado: el último
    // "reiniciar el juego": sesión nueva que lee el guardado
    S.completed = []; S.loaded = false; S.dblTravel = true; S.seenTutorial = false;
    S.completed = []; U.Save.load(); assert.deepEqual(S.completed.slice().sort(), [0, 1, 2, 3, 4]);
    // ajustes que también se guardan
    S.dblTravel = false; S.seenTutorial = true; U.Save.persist();
    S.loaded = false; S.dblTravel = true; S.seenTutorial = false; S.completed = []; U.Save.load();
    assert.equal(S.dblTravel, false); assert.equal(S.seenTutorial, true); assert.equal(S.completed.length, 5);
    U.Save.reset(); assert.deepEqual(JSON.parse(store[U.Save.KEY]).completed, []);
    // guardado corrupto o de otra versión: se ignora sin romper nada
    store[U.Save.KEY] = '{no es json'; S.loaded = false; S.completed = [2]; U.Save.load(); assert.deepEqual(S.completed, [2]);
    store[U.Save.KEY] = JSON.stringify({ v: 99, completed: [0, 1] }); S.loaded = false; S.completed = []; U.Save.load(); assert.deepEqual(S.completed, []);
  } finally { delete globalThis.localStorage; U.session.completed = []; U.session.loaded = true; U.session.seenTutorial = false; U.session.dblTravel = true; }
});

test('nivel 2: Juárez y Zócalo (línea 2) empiezan bloqueadas y no se repite un bloqueo que ya existe', () => {
  const run = U.Rules.createRun(data, 1, U.util.seeded(9));
  assert.deepEqual(data.levels[1].blocked.slice().sort(), ['Juárez', 'Zócalo']);
  assert.ok(run.blocked['Juárez'] && run.blocked['Zócalo']);
  const ids = U.News.eligible(run).map((n) => n.id);
  assert.ok(!ids.includes('n15'), 'la manifestación en el Zócalo ya no aporta nada si Zócalo está bloqueada');
});

test('combi Coyoacán → Pantitlán: viaje largo con tarifa propia (más cara) que no rompe el balance', () => {
  const c = data.connections.find((x) => x.combi && x.a === 'Coyoacán' && x.b === 'Pantitlán');
  assert.ok(c, 'falta la combi'); assert.equal(data.stations['Coyoacán'].line, '3'); assert.equal(data.stations['Pantitlán'].line, '1');
  assert.deepEqual(c.fare, { money: 40, stamina: 55 }); assert.ok(!c.transfer);
  const run = U.Rules.createRun(data, 2, U.util.seeded(4)); run.current = 'Coyoacán'; run.stamina = 100; run.money = 100;
  const chk = U.Rules.canTravel(run, 'Pantitlán');
  assert.ok(chk.ok); assert.equal(chk.cost.money, 40); assert.equal(chk.cost.stamina, 55); assert.equal(chk.cost.time, 35); assert.equal(chk.cost.combi, true);
  // las otras combis siguen con la tarifa normal
  run.current = 'Balderas'; const n = U.Rules.canTravel(run, 'Zócalo'); assert.equal(n.cost.money, data.config.combi.money); assert.equal(n.cost.stamina, data.config.combi.stamina);
});

test('noticias: solo llegan cuando el jugador se mueve (la primera tras el primer movimiento y es de seguridad)', () => {
  assert.equal(typeof U.News.tick, 'undefined', 'ya no hay noticias por reloj');
  const run = U.Rules.createRun(data, 0, U.util.seeded(5)); U.News.intro(run); const base = run.newsLog.length;
  assert.equal(run.newsCount, 0);                                                           // sin moverse: nada, por mucho que pase el tiempo
  const first = U.News.onMove(run); assert.ok(first); assert.equal(first.type, 'security'); assert.equal(run.newsCount, 1); assert.equal(run.newsLog.length, base + 1);
  // con chance 1 las noticias salen cada 2 o 3 movimientos
  const cfg = data.config.news, saved = cfg.chance; cfg.chance = 1;
  try {
    let gaps = [], last = 0;
    for (let mv = 1; mv <= 14 && !run.over; mv++) if (U.News.onMove(run)) { gaps.push(mv - last); last = mv; }
    assert.ok(gaps.length >= 4, 'debería haber varias noticias: ' + gaps);
    gaps.slice(1).forEach((g) => assert.ok(g >= cfg.everyMoves[0] && g <= cfg.everyMoves[1], 'separación fuera de rango: ' + gaps));
  } finally { cfg.chance = saved; }
});
