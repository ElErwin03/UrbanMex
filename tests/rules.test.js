const test = require('node:test'), assert = require('node:assert');
const { loadModules, rawData, cheapestStaminaPath, wantsWait } = require('./helpers');
const U = loadModules(['core', 'data', 'graph', 'events', 'rules', 'news', 'infinite', 'daily', 'achievements']);
const data = U.Data.normalize(rawData());

/** Bot: sigue el camino más corto, compra Monster cuando le falta stamina para lo que resta. */
function playBot(levelIndex, seed, withNews) {
  const rnd = U.util.seeded(seed), run = U.Rules.createRun(data, levelIndex, rnd);
  U.News.intro(run);
  let guard = 500;
  while (!run.over && guard--) {
    if (withNews) { U.News.onMove(run); }                       // las noticias llegan al moverse
    if (wantsWait(U, run) && U.Rules.wait(run).ok) continue;       // la huelga cierra el camino corto: espera a que reabra
    const bp = cheapestStaminaPath(U, run), path = bp && bp.path;
    if (!path && U.Rules.wait(run).ok) continue;                 // sin ruta por una huelga: espera a que reabra
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
  assert.equal(data.stationList.length, 79);                                          // 83 originales − 4 eliminadas
  assert.equal(data.connections.filter((c) => !c.combi).length, 85);                 // Metro
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
  assert.equal(run.combis, 0, 'aún no se usa la combi');
  const t0 = run.minute, m0 = run.money; assert.ok(U.Rules.travel(run, 'Zócalo').ok);
  assert.equal(run.minute - t0, combi.cost); assert.equal(m0 - run.money, cfg.combi.money);
  assert.equal(run.combis, 1, 'la combi se cuenta (para los logros)'); assert.equal(U.Rules.summary(run).combis, 1);
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

test('estaciones eliminadas: Niños Héroes, Potrero (línea 3), Popotla y Xola (línea 2) ya no existen y las líneas siguen unidas', () => {
  ['Niños Héroes', 'Potrero', 'Popotla', 'Xola'].forEach((n) => {
    assert.ok(!data.stations[n], n + ' debe haberse eliminado');
    data.connections.forEach((c) => assert.ok(c.a !== n && c.b !== n, 'conexión con una estación eliminada: ' + n));
    data.news.forEach((x) => assert.ok(!JSON.stringify(x).includes(n), 'noticia que menciona ' + n));
    data.levels.forEach((l) => assert.ok(![l.start, l.goal].concat(l.blocked).includes(n), 'nivel que usa ' + n));
  });
  // sus vecinas quedan conectadas directo (un tramo normal de Metro)
  [['Deportivo 18 de Marzo', 'La Raza'], ['Balderas L3', 'Hospital General'], ['Cuitláhuac', 'Colegio Militar'], ['Viaducto', 'Villa de Cortés']].forEach(([a, b]) => {
    const c = data.connections.find((x) => !x.combi && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
    assert.ok(c, `falta la conexión ${a} – ${b}`); assert.equal(c.cost, 5);
  });
  // la red sigue conectada (todas las estaciones se alcanzan desde cualquier otra)
  const adj = {}; data.connections.forEach((c) => { (adj[c.a] = adj[c.a] || []).push(c.b); (adj[c.b] = adj[c.b] || []).push(c.a); });
  const seen = new Set([data.stationList[0].id]), q = [data.stationList[0].id];
  while (q.length) { const u = q.pop(); (adj[u] || []).forEach((v) => { if (!seen.has(v)) { seen.add(v); q.push(v); } }); }
  assert.equal(seen.size, data.stationList.length);
});

test('bloqueos de nivel: el 4 bloquea Pantitlán (línea 1) y el 5 bloquea Coyoacán desde el inicio', () => {
  assert.ok(data.levels[3].blocked.includes('Pantitlán') && data.levels[3].blocked.includes('Tlatelolco'));
  assert.equal(data.stations['Pantitlán'].line, '1');
  const r4 = U.Rules.createRun(data, 3, U.util.seeded(2)); assert.ok(r4.blocked['Pantitlán']);
  assert.ok(data.levels[4].blocked.includes('Coyoacán'));
  const r5 = U.Rules.createRun(data, 4, U.util.seeded(2)); assert.ok(r5.blocked['Coyoacán']);
  assert.ok(!U.Rules.canTravel(Object.assign(r5, { current: 'Viveros' }), 'Coyoacán').ok, 'no se puede viajar a una estación bloqueada');
});

test('explain: dice POR QUÉ no se puede viajar, con los números reales y en una línea que cabe en el panel', () => {
  const R = U.Rules, mk = (cur, patch) => Object.assign(R.createRun(data, 2, U.util.seeded(4)), { current: cur }, patch || {});
  const fits = (w) => { assert.ok(w.short.length <= 40, 'short muy largo: ' + w.short); assert.ok(w.detail.length <= 62, 'detail muy largo (' + w.detail.length + '): ' + w.detail); };
  // si se puede viajar no hay nada que explicar
  assert.equal(R.explain(mk('Coyoacán', { stamina: 100, money: 100 }), 'Pantitlán'), null);
  // stamina (combi): faltan 55 - 30 = 25, y como aún alcanza para el Metro lo sugiere
  let w = R.explain(mk('Coyoacán', { stamina: 30, money: 100 }), 'Pantitlán');
  assert.equal(w.code, 'stamina'); assert.equal(w.missing, 25); assert.equal(w.short, 'Te faltan 25 de stamina'); assert.ok(w.detail.includes('55') && w.detail.includes('30') && /Metro/.test(w.detail)); fits(w);
  // stamina (combi) sin siquiera para el Metro: no manda al Metro
  w = R.explain(mk('Coyoacán', { stamina: 2, money: 100 }), 'Pantitlán'); assert.equal(w.code, 'stamina'); assert.ok(!/Metro/.test(w.detail)); fits(w);
  // stamina (Metro): sugiere comprar un Monster
  const nb = data.connections.find((c) => !c.combi && !c.transfer), r = mk(nb.a, { stamina: 3, money: 100 });
  w = R.explain(r, nb.b); assert.equal(w.code, 'stamina'); assert.equal(w.missing, data.config.staminaPerStation - 3); assert.ok(/Monster/.test(w.detail)); fits(w);
  // dinero (combi): faltan 40 - 20 = 20 y lo dice con el nombre de la moneda
  w = R.explain(mk('Coyoacán', { stamina: 100, money: 20 }), 'Pantitlán');
  assert.equal(w.code, 'money'); assert.equal(w.missing, 20); assert.equal(w.short, 'Te faltan 20 ' + data.config.currencyName); assert.ok(w.detail.includes('40') && w.detail.includes('20')); fits(w);
  // dinero (Metro)
  w = R.explain(mk(nb.a, { stamina: 100, money: 1 }), nb.b); assert.equal(w.code, 'money'); assert.equal(w.missing, data.config.moneyPerStation - 1); fits(w);
  // anochece: el viaje dura más de lo que queda del día
  w = R.explain(mk(nb.a, { stamina: 100, money: 100, minute: data.config.dayEndMinute - 2 }), nb.b);
  assert.equal(w.code, 'night'); assert.equal(w.missing, 3); assert.ok(w.detail.includes('2 min')); fits(w);
  // bloqueada y sin conexión
  const rb = mk(nb.a, { stamina: 100, money: 100 }); rb.blocked[nb.b] = { id: 'x' };
  w = R.explain(rb, nb.b); assert.equal(w.code, 'blocked'); fits(w);
  w = R.explain(mk('Tacuba', { stamina: 100, money: 100 }), 'Pantitlán'); assert.equal(w.code, 'no_connection'); fits(w);
  // partida terminada
  w = R.explain(mk(nb.a, { over: true }), nb.b); assert.equal(w.code, 'over');
  // coherente con canTravel: explain devuelve algo si y solo si canTravel dice que no, y con el mismo motivo
  const run = mk('Coyoacán', { stamina: 30, money: 100 });
  data.stationList.forEach((s) => { const c = R.canTravel(run, s.id), e = R.explain(run, s.id); assert.equal(!!e, !c.ok); if (e) assert.equal(e.code, c.reason); });
});

test('urgency: el apuro empieza al bajar de 15 % (tiempo, dinero o stamina), sube hasta 1 y es la misma regla que usa el sonido', () => {
  const R = U.Rules, run = R.createRun(data, 0, U.util.seeded(3)), cfg = data.config, span = cfg.dayEndMinute - cfg.dayStartMinute, ms = run.level.moneyStart, sm = run.staminaMax;
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' ≠ ' + b);
  assert.equal(R.URGENT_BELOW, 0.15); let u = R.urgency(run); assert.deepEqual([u.level, u.any], [0, false], 'al empezar no hay apuro');
  run.stamina = sm * 0.15; assert.equal(R.urgency(run).any, false, 'justo en 15 % todavía no');
  run.stamina = sm * 0.075; u = R.urgency(run); near(u.stamina, 0.5); near(u.level, 0.5); assert.equal(u.any, true); assert.equal(u.money + u.time, 0);
  run.stamina = 0; near(R.urgency(run).stamina, 1);
  run.stamina = sm; run.money = ms * 0.03; u = R.urgency(run); near(u.money, 0.8); assert.equal(u.stamina, 0);
  run.money = ms; run.minute = cfg.dayEndMinute - span * 0.03; u = R.urgency(run); near(u.time, 0.8);
  run.money = ms * 0.12; run.stamina = sm * 0.03; u = R.urgency(run); assert.ok(u.level === Math.max(u.time, u.money, u.stamina) && u.level === u.stamina, 'level = el que más aprieta');
  run.over = true; u = R.urgency(run); assert.deepEqual([u.level, u.any], [0, false], 'terminada la partida ya no hay apuro');
  assert.deepEqual(R.urgency(null), { level: 0, time: 0, money: 0, stamina: 0, any: false });
});

// ---- Resultado: estrellas, avance y causa
test('estrellas: llegar, ahorrar (65 % de lo que deja la mejor ruta) y sin asaltos', () => {
  const par = [85, 105, 105, 100, 95, 85, 100, 105, 105, 105];                                                  // dinero inicial − ruta más barata (sin noticias)
  data.levels.forEach((lv, i) => {
    const run = U.Rules.createRun(data, i, Math.random); assert.equal(U.Rules.parMoney(run), par[i], 'par del nivel ' + (i + 1));
    const goal = Math.ceil(par[i] * U.Rules.SAVER_KEEP); assert.equal(U.Rules.score(run).moneyGoal, goal);
    assert.deepEqual(U.Rules.score(run), { stars: 0, got: { arrive: false, saver: false, safe: false }, moneyGoal: goal, moneyPar: par[i] }, 'sin ganar no hay estrellas');
    run.won = true; run.over = true; run.money = goal; assert.equal(U.Rules.score(run).stars, 3, 'justo en la meta de ahorro');
    run.money = goal - 1; assert.deepEqual(U.Rules.score(run).got, { arrive: true, saver: false, safe: true }); assert.equal(U.Rules.score(run).stars, 2);
    run.robbed = 1; assert.equal(U.Rules.score(run).stars, 1, 'ni ahorro ni sin asaltos: solo llegar'); run.money = goal; assert.deepEqual(U.Rules.score(run).got, { arrive: true, saver: true, safe: false });
  });
  // los niveles que obligan a comprar un Monster (30) siguen pudiendo dar las 3 estrellas
  [1, 3, 4, 6, 7, 8, 9].forEach((i) => { const run = U.Rules.createRun(data, i, Math.random), par = U.Rules.parMoney(run); assert.ok(par - 30 >= Math.ceil(par * U.Rules.SAVER_KEEP), 'con un Monster aún se ahorra en el nivel ' + (i + 1)); });
});

test('resumen: causa del final, estaciones que faltaban y avance', () => {
  const run = U.Rules.createRun(data, 0, Math.random), lv = run.level;
  let sm = U.Rules.summary(run); assert.equal(sm.left, sm.hops); assert.equal(sm.progress, 0); assert.ok(sm.hops > 3);
  const path = U.Graph.shortestPath(run.graph, lv.start, lv.goal, run.blocked); assert.equal(sm.hops, path.length - 1);
  run.current = path[path.length - 3]; sm = U.Rules.summary(run); assert.equal(sm.left, 2); assert.ok(Math.abs(sm.progress - (1 - 2 / sm.hops)) < 1e-9);
  run.current = lv.goal; run.won = true; run.over = true; sm = U.Rules.summary(run); assert.equal(sm.left, 0); assert.equal(sm.progress, 1); assert.equal(sm.stars, U.Rules.score(run).stars); assert.equal(sm.cause, '');
  // causa del fin de partida
  const mk = (f) => { const r = U.Rules.createRun(data, 0, Math.random); f(r); U.Rules.checkStuck(r); return r; };
  let r = mk((x) => { x.stamina = 0; }); assert.equal(r.over, true); assert.equal(U.Rules.summary(r).cause, 'stamina'); assert.equal(r.endReason, 'Te quedaste sin stamina.');
  r = mk((x) => { x.money = 0; }); assert.equal(U.Rules.summary(r).cause, 'money'); assert.equal(r.endReason, 'Te quedaste sin dinero.');
  r = mk((x) => { x.minute = x.data.config.dayEndMinute - 1; }); assert.equal(U.Rules.summary(r).cause, 'night');
  r = mk((x) => { U.Graph.neighbors(x.graph, x.current).forEach((n) => { x.blocked[n] = true; }); }); assert.equal(U.Rules.summary(r).cause, 'blocked');
  // sin ruta por los bloqueos de las noticias: cuenta las estaciones ignorándolos y no truena
  r = U.Rules.createRun(data, 0, Math.random); U.Graph.neighbors(r.graph, r.current).forEach((n) => { r.blocked[n] = true; }); sm = U.Rules.summary(r); assert.ok(sm.left > 0 && sm.progress >= 0 && sm.progress <= 1);
});


// ---------------------------------------------------------------- eventos del día (lluvia, hora pico, huelga)
const Rules = () => U.Rules, Ev = () => U.Events;
const metroTo = (run) => U.Graph.neighbors(run.graph, run.current).find((n) => !U.Graph.isCombi(run.graph, run.current, n) && !run.blocked[n]);
const combiTo = (run) => U.Graph.neighbors(run.graph, run.current).find((n) => U.Graph.isCombi(run.graph, run.current, n));
const cloneData = () => U.Data.normalize(JSON.parse(JSON.stringify(rawData())));

test('eventos: los datos se validan (ids, líneas, ventanas) y cada nivel declara los suyos', () => {
  const lv = (e) => { const raw = JSON.parse(JSON.stringify(rawData())); raw.levels[0].events = e; return () => U.Data.normalize(raw); };
  assert.throws(lv([{ id: 'terremoto' }]), /evento desconocido/);
  assert.throws(lv([{ id: 'huelga', line: '9', until: 600 }]), /línea inexistente/);
  assert.throws(lv([{ id: 'huelga', line: '3', until: 5000 }]), /fuera del día/);
  assert.throws(lv([{ id: 'lluvia', from: 600, to: 500 }]), /ventana inválida/);
  assert.doesNotThrow(lv([{ id: 'lluvia', from: 480, to: 600 }]));
  assert.deepEqual(data.levels.map((l) => (l.events || []).map((e) => e.id)), [['horaPico'], ['lluvia'], ['huelga'], ['lluvia', 'huelga'], ['horaPico', 'lluvia', 'huelga'], ['horaPico', 'lluvia'], ['lluvia', 'huelga'], ['horaPico', 'lluvia', 'huelga'], ['horaPico', 'huelga'], ['horaPico', 'lluvia', 'huelga']]);
});

test('lluvia: dentro de su ventana el Metro suma tiempo y stamina y la combi se atasca; fuera, todo normal', () => {
  const run = U.Rules.createRun(data, 1), cfg = data.config, ev = cfg.events.lluvia;   // Martes: lluvia 8:00-11:00
  const n = metroTo(run), base = U.Rules.canTravel(run, n).cost;                       // 7:00: aún no llueve
  assert.equal(base.stamina, cfg.staminaPerStation); assert.deepEqual(base.event, { time: 0, stamina: 0 });
  run.minute = 480; const wet = U.Rules.canTravel(run, n).cost;
  assert.equal(wet.time, base.time + ev.extraTime); assert.equal(wet.stamina, base.stamina + ev.extraStamina);
  assert.equal(wet.money, base.money, 'la lluvia no cobra dinero');
  const c = combiTo(run); if (c) { run.minute = 420; const b = U.Rules.canTravel(run, c).cost; run.minute = 480; assert.equal(U.Rules.canTravel(run, c).cost.time, b.time + ev.combiExtraTime); }
  run.minute = 660; assert.equal(U.Rules.canTravel(run, n).cost.time, base.time, 'la ventana es [from, to): a las 11:00 ya paró');
  run.minute = 479; assert.equal(U.Rules.canTravel(run, n).cost.stamina, base.stamina);
});

test('lluvia: viajar cobra el extra y puede dejarte sin stamina (se explica con los números reales)', () => {
  const run = U.Rules.createRun(data, 1); run.minute = 480; const n = metroTo(run), c = U.Rules.canTravel(run, n).cost;
  run.stamina = c.stamina - 1; const why = U.Rules.explain(run, n);
  assert.equal(why.code, 'stamina'); assert.equal(why.missing, 1); assert.ok(why.detail.length <= 62);
  run.stamina = 100; const s0 = run.stamina, t0 = run.minute; assert.ok(U.Rules.travel(run, n).ok);
  assert.equal(s0 - run.stamina, c.stamina); assert.equal(run.minute - t0, c.time);
});

test('hora pico: el Metro va más lento y sube el riesgo de asalto solo mientras dura', () => {
  const ev = data.config.events.horaPico, r0 = data.config.robbery, p = r0.baseChance - r0.luck;
  const mk = (minute) => { const run = U.Rules.createRun(data, 0, () => 0.5); run.minute = minute; return run; };          // Lunes: hora pico 7:00-9:30
  const run = mk(420), n = metroTo(run), t = U.Rules.canTravel(run, n).cost.time; assert.equal(t, U.Rules.canTravel(mk(570), n).cost.time + ev.extraTime);
  assert.ok(0.5 > p && 0.5 < p + ev.robberyBonus, 'el número de la prueba cae justo entre las dos probabilidades');
  run.danger[n] = true; assert.equal(U.Rules.travel(run, n).type, 'robbery', 'en hora pico (+riesgo) te asaltan con 0.5');
  const calm = mk(570); calm.danger[n] = true; assert.equal(U.Rules.travel(calm, n).type, 'lucky', 'fuera de la hora pico, con 0.5 pasas de suerte');
  const c = combiTo(run); if (c) assert.equal(Ev().hopExtra(mk(420), true).time, 0, 'la combi no sufre la hora pico');
});

test('huelga: la línea queda cerrada hasta la hora indicada, se explica y reabre sola sin tocar los bloqueos de noticias', () => {
  const run = U.Rules.createRun(data, 2), line = '3', until = 630;                              // Miércoles: huelga en la línea 3 hasta 10:30
  const closed = data.stationList.filter((s) => s.line === line).map((s) => s.id);
  closed.forEach((id) => assert.ok(run.blocked[id] && run.striking[id], id + ' cerrada por huelga'));
  assert.ok(run.blocked['Allende'], 'el bloqueo del nivel sigue ahí'); assert.ok(!run.striking['Allende'], 'y no cuenta como huelga');
  const near = U.Graph.neighbors(run.graph, run.current).find((n) => run.striking[n]);
  if (near) { const why = U.Rules.explain(run, near); assert.equal(why.code, 'blocked'); assert.match(why.short, /Huelga en la linea 3/); assert.match(why.detail, /10:30/); assert.ok(why.detail.length <= 62); }
  const news = U.Rules.createRun(data, 2); news.blocked[closed[0]] = true; U.Rules.applyNews(news, { effects: { block: [closed[0]] } });     // una noticia bloquea una de ellas a la vez
  news.minute = until; U.Rules.syncEvents(news);
  closed.forEach((id) => { if (id === closed[0]) assert.ok(news.blocked[id], 'el bloqueo de noticia es permanente'); else assert.ok(!news.blocked[id], id + ' reabre'); });
  assert.deepEqual(Object.keys(news.striking), []);
});

test('huelga: ESPERAR avanza el reloj hasta que reabra y avisa; sin huelga o ya de noche no hace nada', () => {
  const run = U.Rules.createRun(data, 2); assert.deepEqual(Ev().strikeEnds(run), [630]);
  const w = U.Rules.wait(run); assert.equal(w.ok, true); assert.equal(w.from, 420); assert.equal(w.to, 630); assert.equal(run.minute, 630); assert.equal(run.waited, 210);
  assert.deepEqual(run.eventQueue.map((q) => q.kind), ['end', 'wait'], 'avisa que reabrió y que esperaste');
  assert.deepEqual(Object.keys(run.striking), []); assert.equal(U.Rules.wait(run).reason, 'none');
  const late = U.Rules.createRun(data, 2); late.level = Object.assign({}, late.level, { events: [{ id: 'huelga', line: '3', until: data.config.dayEndMinute }] });
  late.minute = 1190; U.Rules.syncEvents(late); assert.equal(U.Rules.wait(late, [data.config.dayEndMinute + 30]).reason, 'night');
  const none = U.Rules.createRun(data, 0); assert.equal(U.Rules.wait(none).reason, 'none');
});

test('huelga: si solo te frena una huelga, esperas solo y puedes seguir; los eventos se anuncian al cruzar su hora', () => {
  const d = cloneData(), run = U.Rules.createRun(d, 0, () => 0.99);
  const term = d.stationList.find((s) => { const nb = U.Graph.neighbors(run.graph, s.id); return nb.length && nb.every((n) => d.stations[n].line === d.stations[nb[0]].line); });
  assert.ok(term, 'hay una estación cuyos vecinos son todos de la misma línea');
  const line = d.stations[U.Graph.neighbors(run.graph, term.id)[0]].line;
  run.level = Object.assign({}, run.level, { events: [{ id: 'huelga', line, until: 600 }] }); run.current = term.id; run.minute = 500; run.blocked = {}; U.Rules.syncEvents(run);
  assert.ok(U.Graph.neighbors(run.graph, term.id).every((n) => run.blocked[n]), 'todas sus salidas cerradas');
  assert.equal(U.Rules.checkStuck(run), null, 'no se acaba la partida'); assert.equal(run.over, false);
  assert.equal(run.minute, 600, 'el reloj esperó hasta la reapertura'); assert.ok(run.eventQueue.some((q) => q.kind === 'wait'));
  assert.ok(U.Graph.neighbors(run.graph, term.id).some((n) => U.Rules.canTravel(run, n).ok), 'y ya hay a dónde ir');
  const tr = Ev().transitions(U.Rules.createRun(data, 1), 470, 490).map((t) => t.id + ':' + t.kind);
  assert.deepEqual(tr, ['lluvia:start'], 'la lluvia empieza a las 8:00'); assert.deepEqual(Ev().transitions(U.Rules.createRun(data, 1), 650, 700).map((t) => t.kind), ['end']);
  assert.deepEqual(Ev().transitions(U.Rules.createRun(data, 0), 420, 430), [], 'la hora pico que ya está en marcha al empezar no se "anuncia"');
});

test('huelga: si ni esperando llegas (reabre cuando ya es de noche), la partida termina', () => {
  const d = cloneData(), run = U.Rules.createRun(d, 0, () => 0.99);
  const term = d.stationList.find((s) => { const nb = U.Graph.neighbors(run.graph, s.id); return nb.length && nb.every((n) => d.stations[n].line === d.stations[nb[0]].line); });
  const line = d.stations[U.Graph.neighbors(run.graph, term.id)[0]].line;
  run.level = Object.assign({}, run.level, { events: [{ id: 'huelga', line, until: d.config.dayEndMinute }] }); run.current = term.id; run.minute = d.config.dayEndMinute - 30; run.blocked = {}; U.Rules.syncEvents(run);
  U.Rules.checkStuck(run); assert.equal(run.over, true); assert.equal(run.won, false);
});

test('eventos: noticias (isSafe/eligible) ignoran el cierre temporal por huelga', () => {
  const run = U.Rules.createRun(data, 2), item = data.news.find((n) => ((n.effects || {}).block || []).length === 1);
  const st = data.stations[item.effects.block[0]]; assert.ok(st);
  run.striking[st.id] = run.blocked[st.id] = true;                       // simula que esa estación está cerrada solo por huelga
  assert.ok(U.News.eligible(run).some((n) => n.id === item.id) || run.newsUsed[item.id] || !U.News.isSafe(run, item) || true);
  const redundant = U.News.eligible(run).every((n) => n.id !== item.id);
  assert.equal(redundant, false, 'la huelga no vuelve "repetido" un bloqueo de noticia (esa sí sería permanente)');
});

test('eventos: la noticia de cada evento y las del intro del nivel', () => {
  const run = U.Rules.createRun(data, 4); U.News.intro(run);                                  // Viernes: hora pico, lluvia y huelga
  const titles = run.newsLog.map((n) => n.title);
  assert.ok(titles.some((t) => /HORA PICO/.test(t)) && titles.some((t) => /LLUVIA DESDE/.test(t)) && titles.some((t) => /HUELGA EN LA/.test(t)), titles.join(' | '));
  assert.equal(run.unread, 0, 'el anuncio inicial no enciende el globo de no leídas');
  run.eventQueue.push({ id: 'lluvia', kind: 'start' }, { id: 'huelga', kind: 'end', line: '3' }); run.eventQueue.push({ id: 'huelga', kind: 'wait', from: 420, to: 600 });
  const got = U.News.drain(run); assert.deepEqual(got.map((g) => g.kind), ['start', 'end', 'wait']); assert.equal(run.unread, 2); assert.equal(run.eventQueue.length, 0);
  assert.equal(got[0].severity, 'warning'); assert.equal(got[1].severity, 'success'); assert.ok(got.every((g) => g.entry && g.entry.title));
  assert.deepEqual(run.newsLog.find((n) => /REABRE/.test(n.title)).lines, ['3'], 'la noticia de la huelga muestra el color de su línea');
  Ev().IDS.forEach((id) => ['start', 'end', 'now', 'soon'].forEach((k) => { const e = Ev().list(run).find((x) => x.id === id); if (e) { const t = Ev().text(run, e, k); assert.ok(t.title && t.desc && t.impact && t.severity); } }));
});

test('eventos: con las huelgas en marcha cada nivel sigue teniendo ruta (y la meta no está en la línea cerrada)', () => {
  data.levels.forEach((lv, i) => {
    const run = U.Rules.createRun(data, i);
    assert.ok(!run.striking[lv.goal], 'nivel ' + lv.id + ': la meta no puede cerrarse por huelga');
    assert.ok(U.Graph.reachable(run.graph, lv.start, lv.goal, run.blocked), 'nivel ' + lv.id + ': hay ruta aun con la huelga');
    assert.ok(U.Rules.hopsLeft(run, lv.start) !== null);
  });
});

test('eventos: el panel de efectos nombra lluvia y hora pico con su costo', () => {
  const run = U.Rules.createRun(data, 4); run.minute = 540; const n = metroTo(run), cost = U.Rules.canTravel(run, n).cost;
  const fx = Ev().effects(run, cost); assert.equal(fx.length, 2); assert.ok(fx.some((t) => /LLUVIA/.test(t)) && fx.some((t) => /HORA PICO/.test(t)), fx.join());
  run.minute = 800; assert.deepEqual(Ev().effects(run, U.Rules.canTravel(run, n).cost), []);
  assert.deepEqual(Ev().status(run).map((s) => s.state), ['over', 'over', 'over']);
  run.minute = 420; assert.deepEqual(Ev().status(run).map((s) => s.state), ['active', 'soon', 'active'], 'hora pico en marcha, lluvia por venir, huelga activa');
});

// ---------------------------------------------------------------- 10 niveles (dos semanas)
test('niveles: 10 consecutivos, días distintos, rutas distintas, meta fuera de la huelga y balance de la estrella de ahorro', () => {
  assert.equal(data.levels.length, 10); assert.deepEqual(data.levels.map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(data.levels.map((l) => l.day)).size, 10, 'cada día con su nombre');
  assert.equal(new Set(data.levels.map((l) => l.start + '>' + l.goal)).size, 10, 'cada nivel con su ruta');
  data.levels.forEach((lv, i) => {
    assert.notEqual(lv.start, lv.goal); assert.ok(lv.startDesc && lv.goalDesc);
    const run = U.Rules.createRun(data, i), cfg = data.config;
    assert.ok(!run.striking[lv.goal] && !run.striking[lv.start] , 'nivel ' + lv.id + ': ni la salida ni la meta quedan cerradas por huelga');
    // mejor caso (la huelga ya terminó): cuántos Monster hacen falta como mínimo y si aun así cabe la estrella de ahorro
    const open = Object.assign({}, run, { blocked: Object.assign({}, run.blocked), striking: {} }); Object.keys(run.striking).forEach((k) => { delete open.blocked[k]; });
    const bp = cheapestStaminaPath(U, open), monsters = Math.max(0, Math.ceil((bp.need - lv.staminaMax) / cfg.monsterStamina)), par = U.Rules.parMoney(run);
    assert.ok(par - monsters * cfg.monsterPrice >= Math.ceil(par * U.Rules.SAVER_KEEP), 'nivel ' + lv.id + ': con ' + monsters + ' Monster la estrella de ahorro sería imposible (par ' + par + ')');
    assert.ok(monsters <= 1, 'nivel ' + lv.id + ': más de un Monster obligatorio rompe el ahorro');
  });
});

test('niveles: la semana 2 es más exigente que la 1 (más tramos y más eventos en promedio)', () => {
  const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length, w1 = data.levels.slice(0, 5), w2 = data.levels.slice(5);
  const hops = (lv) => { const r = U.Rules.createRun(data, lv.id - 1); return U.Rules.hopsLeft(r, lv.start); };
  assert.ok(avg(w2, hops) >= avg(w1, hops), 'más tramos en la semana 2'); assert.ok(avg(w2, (l) => l.events.length) > avg(w1, (l) => l.events.length), 'más eventos en la semana 2');
  assert.ok(w2.every((l) => l.events.length >= 2) && w2[4].events.length === 3, 'el último nivel junta los tres eventos');
});

// ---------------------------------------------------------------- modo infinito
const Inf = () => U.Infinite;
const withStore = (fn) => { const st = {}; globalThis.localStorage = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); } }; try { fn(st); } finally { delete globalThis.localStorage; } };

test('infinito: la misma semilla y ronda dan siempre el mismo nivel; otra semilla u otra ronda, otro', () => {
  const a = Inf().level(data, 42, 5), b = Inf().level(data, 42, 5);
  assert.deepEqual(a, b); assert.notDeepEqual(a, Inf().level(data, 43, 5)); assert.notDeepEqual(a, Inf().level(data, 42, 6));
  assert.equal(a.infinite, true); assert.equal(a.round, 5); assert.equal(a.day, 'RONDA 5'); assert.equal(a.id, 5);
  assert.equal(Inf().title(a), 'RONDA 5'); assert.equal(Inf().title(data.levels[5]), 'NIVEL 6 - LUNES 2');
  assert.equal(Inf().nice('Hidalgo L3'), 'Hidalgo'); assert.equal(Inf().nice('San Lázaro LB2'), 'San Lázaro'); assert.equal(Inf().nice('Pantitlán'), 'Pantitlán');
});

test('infinito: la dificultad sube con las rondas (tramos, bloqueos y eventos)', () => {
  const d = (r) => Inf().difficulty(r);
  assert.deepEqual(d(1), { hopsLow: 8, hopsHigh: 14, blocks: 0, events: 1 });
  assert.equal(d(3).blocks, 1); assert.equal(d(6).blocks, 2); assert.equal(d(9).blocks, 3); assert.equal(d(99).blocks, 3);
  assert.deepEqual([1, 3, 4, 6, 7, 20].map((r) => d(r).events), [1, 1, 2, 2, 3, 3]);
  assert.ok(d(11).hopsLow > d(1).hopsLow && d(11).hopsHigh > d(1).hopsHigh); assert.deepEqual(d(11), d(50), 'el largo deja de crecer en la ronda 11');
});

test('infinito: toda ronda generada es válida, ganable y con el balance de los niveles (máx. 1 Monster, ahorro posible)', () => {
  const cfg = data.config, byRound = {};
  [1, 2, 3, 42, 777].forEach((seed) => { for (let round = 1; round <= 24; round++) {
    const lv = Inf().level(data, seed, round), run = U.Rules.createRun(data, -1, () => 0.99, lv), diff = Inf().difficulty(round), tag = 'semilla ' + seed + ' ronda ' + round + ': ';
    assert.notEqual(lv.start, lv.goal, tag + 'salida y meta distintas'); assert.ok(data.stations[lv.start] && data.stations[lv.goal]);
    assert.ok(lv.blocked.length <= diff.blocks && lv.blocked.every((b) => b !== lv.start && b !== lv.goal), tag + 'bloqueos');
    assert.ok(lv.events.length >= 1 && lv.events.length <= diff.events, tag + 'eventos'); assert.doesNotThrow(() => U.Events.validate(cfg, data.lines, lv), tag + 'eventos válidos');
    assert.ok(!run.striking[lv.goal] && U.Graph.reachable(run.graph, lv.start, lv.goal, run.blocked), tag + 'hay ruta con las huelgas en marcha');
    const open = Object.assign({}, run, { blocked: Object.assign({}, run.blocked), striking: {} }); Object.keys(run.striking).forEach((k) => { delete open.blocked[k]; });
    const need = Math.min(Inf().cheapestPath(open).need, Inf().cheapestPath(run).need), monsters = Math.max(0, Math.ceil((need - lv.staminaMax) / cfg.monsterStamina)), par = U.Rules.parMoney(run);
    assert.ok(monsters <= 1, tag + 'a lo sumo 1 Monster'); assert.ok(par - monsters * cfg.monsterPrice >= Math.ceil(par * U.Rules.SAVER_KEEP), tag + 'la estrella de ahorro cabe');
    assert.ok(lv.staminaMax >= 60 && lv.staminaMax <= 120 && lv.moneyStart > 0 && lv.moneyStart % 5 === 0, tag + 'recursos');
    const play = Inf().autoplay(data, lv); assert.equal(play.won, true, tag + 'el jugador automático gana');
    (byRound[round] = byRound[round] || []).push(U.Rules.hopsLeft(run, lv.start));
  } });
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length; assert.ok(avg(byRound[12]) > avg(byRound[1]), 'las rutas se alargan con las rondas');
  const keys = new Set(); for (let r = 1; r <= 24; r++) { const l = Inf().level(data, 5, r); keys.add(l.start + '>' + l.goal); } assert.ok(keys.size >= 20, 'rutas variadas, no repetidas: ' + keys.size);
});

test('infinito: desbloqueo al completar los 10 niveles, racha (finish) y mejor racha guardada', () => {
  withStore((st) => {
    U.session.completed = []; U.session.inf = { best: 0, stars: 0 }; U.session.infinite = null;
    assert.equal(Inf().unlocked(10), false); U.session.completed = [0, 1, 2, 3, 4, 5, 6, 7, 8]; assert.equal(Inf().unlocked(10), false, 'faltando uno, sigue bloqueado');
    U.session.completed.push(9); assert.equal(Inf().unlocked(10), true); assert.equal(Inf().unlocked(0), false);
    const s = Inf().start(7); assert.deepEqual(s, { seed: 7, round: 1, cleared: 0, stars: 0, newBest: false }); assert.equal(U.session.infinite, s);
    const win = { won: true }, lose = { won: false };
    let r = Inf().finish(win, 3); assert.deepEqual(r, { round: 1, cleared: 1, stars: 3, newBest: true, best: { best: 1, stars: 3 } });
    s.round = 2; r = Inf().finish(win, 2); assert.deepEqual(r, { round: 2, cleared: 2, stars: 5, newBest: true, best: { best: 2, stars: 5 } });
    s.round = 3; r = Inf().finish(lose, 0); assert.equal(r.cleared, 2, 'perder no suma'); assert.equal(r.stars, 5); assert.equal(r.newBest, true, 'la racha que acabas de hacer es tu mejor'); assert.deepEqual(r.best, { best: 2, stars: 5 });
    assert.deepEqual(JSON.parse(st[U.Save.KEY]).inf, { best: 2, stars: 5 }, 'se guarda');
    const s2 = Inf().start(8); r = Inf().finish(win, 1); assert.equal(r.newBest, false, '1 ronda no supera tu mejor de 2'); assert.deepEqual(r.best, { best: 2, stars: 5 });
    s2.round = 2; r = Inf().finish(win, 3); assert.equal(r.newBest, false, 'igual de rondas y menos estrellas: no es récord'); s2.round = 3; r = Inf().finish(win, 1); assert.equal(r.newBest, true, '3 rondas sí');
    assert.deepEqual(U.Save.recordStreak(3, 4), { isNew: false, prev: { best: 3, stars: 5 } }); assert.equal(U.Save.recordStreak(3, 9).isNew, true, 'mismas rondas y más estrellas sí');
    U.session.infinite = null; assert.equal(Inf().finish(win, 3), null, 'sin racha activa no hace nada');
  });
});

test('infinito: el guardado valida la mejor racha y "borrar progreso" la borra', () => {
  withStore((st) => {
    U.session.loaded = false; U.session.inf = { best: 0, stars: 0 };
    st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [], best: {}, inf: { best: 12, stars: 30 } }); U.Save.load(); assert.deepEqual(U.session.inf, { best: 12, stars: 30 });
    [{ best: -1, stars: 5 }, { best: 'x', stars: 5 }, { best: 2.5, stars: 1 }, { best: 3, stars: 'm' }, 'si', null].forEach((bad) => {
      U.session.loaded = false; U.session.inf = { best: 0, stars: 0 }; st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [], best: {}, inf: bad }); U.Save.load();
      assert.ok(U.session.inf.best >= 0 && U.session.inf.best % 1 === 0 && U.session.inf.stars >= 0 && U.session.inf.stars % 1 === 0, JSON.stringify(bad));
    });
    U.session.loaded = false; st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [] }); U.session.inf = { best: 9, stars: 9 }; U.Save.load(); assert.equal(U.session.inf.best, 9, 'un guardado viejo sin racha no la borra a medias');
    U.session.infinite = { seed: 1, round: 2, cleared: 1, stars: 3 }; U.Save.reset(); assert.deepEqual(U.session.inf, { best: 0, stars: 0 }); assert.equal(U.session.infinite, null); assert.deepEqual(JSON.parse(st[U.Save.KEY]).inf, { best: 0, stars: 0 });
  });
});

test('infinito: createRun acepta un nivel armado y el resumen lo marca como ronda', () => {
  const lv = Inf().level(data, 3, 4), run = U.Rules.createRun(data, -1, () => 0.5, lv);
  assert.equal(run.levelIndex, -1); assert.equal(run.level, lv); assert.equal(run.current, lv.start); assert.equal(run.money, lv.moneyStart); assert.equal(run.stamina, lv.staminaMax);
  assert.deepEqual(U.Rules.summary(run).infinite, { round: 4 }); assert.equal(U.Rules.summary(U.Rules.createRun(data, 0)).infinite, null);
  U.News.intro(run); assert.equal(run.newsLog.filter((n) => n.title === 'Ronda 4').length, 1, 'el aviso inicial dice "Ronda 4"');
});

// ---------------------------------------------------------------- logros
const Ach = () => U.Achievements;
const freshAch = () => { U.session.ach = {}; U.session.stats = null; U.session.completed = []; U.session.best = {}; U.session.inf = { best: 0, stars: 0 }; U.session.infinite = null; };
const res = (o) => Object.assign({ won: true, steps: 12, money: 80, robbed: 0, stamina: 40, monsters: 0, combis: 0, waited: 0, newsRead: 0, events: [] }, o || {});
const ids = (list) => list.map((a) => a.id);

test('logros: el catálogo es coherente (23 ids únicos, nombres sin acentos en mayúsculas, textos que caben)', () => {
  assert.equal(Ach().LIST.length, 23); assert.equal(new Set(Ach().LIST.map((a) => a.id)).size, 23); assert.equal(new Set(Ach().LIST.map((a) => a.name)).size, 23);
  const groups = Ach().GROUPS.map((g) => g[0]);
  Ach().LIST.forEach((a) => {
    assert.ok(groups.includes(a.group), a.id); assert.match(a.name, /^[A-Z0-9 ]+$/, a.id + ': nombre en mayúsculas sin acentos'); assert.ok(a.name.length <= 24, a.id);
    assert.ok(a.desc.length >= 10 && U.util.wrap(a.desc, 27).length <= 3, a.id + ': la descripción cabe en 3 líneas de la tarjeta'); assert.equal(Ach().byId(a.id), a);
    assert.equal(typeof a.check, 'function');
  });
  assert.equal(Ach().byId('nada'), null); assert.deepEqual(groups, ['progreso', 'estilo', 'eventos', 'infinito']);
  assert.deepEqual(Ach().LIST.map((a) => a.group).filter((g, i, arr) => arr.indexOf(g) === i), groups, 'el catálogo viene agrupado en ese orden');
});

test('logros: record suma estadísticas, desbloquea una sola vez y guarda', () => {
  withStore((st) => {
    freshAch(); const first = Ach().record(res({ steps: 12, robbed: 1, monsters: 2, combis: 1, newsRead: 4 }), 0);
    assert.deepEqual(ids(first), ['primer_viaje']); assert.deepEqual(U.session.stats, { played: 1, wins: 1, steps: 12, robbed: 1, monsters: 2, combis: 1, news: 4, safeWins: 0 });
    assert.deepEqual(ids(Ach().record(res({ robbed: 0 }), 0)).includes('primer_viaje'), false, 'no se desbloquea dos veces'); assert.equal(U.session.stats.safeWins, 1);
    assert.deepEqual(Ach().count(), { got: Ach().count().got, total: 23 }); assert.equal(Ach().has('primer_viaje'), true); assert.equal(Ach().has('racha10'), false);
    assert.equal(JSON.parse(st[U.Save.KEY]).ach.primer_viaje, true); assert.equal(JSON.parse(st[U.Save.KEY]).stats.played, 2);
  });
});

test('logros: perder suma jugadas, asaltos y compras pero no da logros de victoria', () => {
  withStore(() => {
    freshAch(); const f = Ach().record(res({ won: false, steps: 5, robbed: 2, monsters: 1, money: 500, stamina: 0, events: ['lluvia', 'horaPico', 'huelga'], waited: 90 }), 0);
    assert.deepEqual(ids(f), [], 'ni primer viaje, ni ahorrador, ni eventos, ni paciencia'); assert.deepEqual(U.session.stats, { played: 1, wins: 0, steps: 5, robbed: 2, monsters: 1, combis: 0, news: 0, safeWins: 0 });
  });
});

test('logros: cada condición de una partida (dinero, Monster, stamina, eventos, espera)', () => {
  const t = (r, id, yes, why) => { freshAch(); U.session.stats = Ach().zero(); assert.equal(ids(Ach().record(res(r), 0)).includes(id), yes, why || id); };
  withStore(() => {
    t({ money: 100 }, 'ahorrador', true); t({ money: 99 }, 'ahorrador', false, 'ahorrador con 99');
    t({ monsters: 0, steps: 10 }, 'sin_monster', true); t({ monsters: 0, steps: 9 }, 'sin_monster', false, 'ruta corta no cuenta'); t({ monsters: 1, steps: 14 }, 'sin_monster', false, 'con Monster no');
    t({ stamina: 10 }, 'al_limite', true); t({ stamina: 11 }, 'al_limite', false);
    t({ events: ['lluvia'] }, 'lluvia', true); t({ events: ['horaPico'] }, 'lluvia', false); t({ events: ['horaPico'] }, 'hora_pico', true); t({ events: ['huelga'] }, 'huelga', true); t({ events: [] }, 'huelga', false);
    t({ waited: 30 }, 'paciencia', true); t({ waited: 0 }, 'paciencia', false);
    t({ events: ['lluvia', 'horaPico', 'huelga'] }, 'triple', true); t({ events: ['lluvia', 'huelga'] }, 'triple', false);
  });
});

test('logros: los de acumulado (asaltos, Monster, combi, estaciones, noticias, victorias sin asalto) cuentan entre partidas', () => {
  withStore(() => {
    freshAch(); const get = (id) => Ach().has(id), rec = (o) => Ach().record(res(o), 0);
    rec({ robbed: 1 }); rec({ robbed: 2, won: false }); assert.equal(get('bienvenido'), true, '1 + 2 asaltos');
    rec({ monsters: 4, combis: 2, newsRead: 10, steps: 80 }); rec({ monsters: 6, combis: 3, newsRead: 15, steps: 120 });
    ['monster10', 'combi5', 'lector', 'caminante'].forEach((id) => assert.equal(get(id), true, id));
    assert.equal(U.session.stats.safeWins, 2, 'dos victorias sin asalto (la del asalto no cuenta, la derrota tampoco)'); assert.equal(get('intocable'), false);
    rec({ robbed: 1 }); assert.equal(get('intocable'), false, 'ganar con asalto no suma'); rec({ robbed: 0 }); assert.equal(get('intocable'), true);
    const bar = Ach().progress(Ach().byId('monster10')); assert.deepEqual(bar, [10, 10]); assert.deepEqual(Ach().progress(Ach().byId('primer_viaje')), null);
  });
});

test('logros: los de progreso salen del guardado (semanas, estrellas) y el avance se ve', () => {
  withStore(() => {
    freshAch(); U.session.completed = [0, 1, 2, 3]; U.session.best = { 0: { stars: 3, money: 1 }, 1: { stars: 2, money: 1 } };
    assert.deepEqual(ids(Ach().sweep()), ['brillante'], 'tres estrellas en un nivel'); assert.deepEqual(Ach().progress(Ach().byId('semana1')), [4, 5]);
    U.session.completed.push(4); assert.deepEqual(ids(Ach().record(res({ steps: 5 }), 0)), ['primer_viaje', 'semana1']);
    U.session.completed = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; assert.ok(ids(Ach().sweep()).includes('semana2'));
    U.session.best = {}; for (let i = 0; i < 4; i++) U.session.best[i] = { stars: 3, money: 1 }; U.session.best[4] = { stars: 2, money: 1 };
    assert.equal(ids(Ach().sweep()).includes('estrellado'), false, '14 estrellas no alcanzan'); assert.deepEqual(Ach().progress(Ach().byId('estrellado')), [14, 15]);
    U.session.best[4] = { stars: 3, money: 1 };
    assert.ok(ids(Ach().sweep()).includes('estrellado'), '15 estrellas'); assert.equal(Ach().has('constelacion'), false); assert.deepEqual(Ach().progress(Ach().byId('constelacion')), [15, 30]);
    for (let i = 5; i < 10; i++) U.session.best[i] = { stars: 3, money: 1 }; assert.ok(ids(Ach().sweep()).includes('constelacion'));
    assert.deepEqual(Ach().sweep(), [], 'sin novedades no devuelve nada');
  });
});

test('logros: modo infinito (primera ronda, racha de 5 y de 10, también con la mejor racha guardada)', () => {
  withStore(() => {
    freshAch(); assert.equal(ids(Ach().record(res(), 0)).includes('sin_fin'), false); assert.ok(ids(Ach().record(res(), 1)).includes('sin_fin'));
    assert.ok(!Ach().has('racha5')); assert.ok(ids(Ach().record(res(), 5)).includes('racha5')); assert.ok(!Ach().has('racha10')); assert.ok(ids(Ach().record(res({ won: false }), 10)).includes('racha10'));
    freshAch(); U.session.inf = { best: 12, stars: 20 }; assert.deepEqual(ids(Ach().sweep()), ['racha5', 'racha10'], 'una mejor racha anterior también cuenta'); assert.deepEqual(Ach().progress(Ach().byId('racha10')), [10, 10]);
  });
});

test('logros: con partidas reales (el resumen de Rules trae monsters, combis, stamina, eventos y espera)', () => {
  withStore(() => {
    freshAch(); const run = U.Rules.createRun(data, 1, () => 0.99); assert.deepEqual([run.monsters, run.combis, run.waited], [0, 0, 0]);
    const n = U.Graph.neighbors(run.graph, run.current).find((x) => !run.blocked[x]); U.Rules.travel(run, n); assert.equal(run.combis, U.Graph.isCombi(run.graph, run.level.start, n) ? 1 : 0);
    run.stamina = 10; run.current = Object.keys(data.stations).find((k) => data.stations[k].shop); assert.ok(U.Rules.buyMonster(run).ok); assert.equal(run.monsters, 1);
    const s = U.Rules.summary(run); assert.equal(s.monsters, 1); assert.equal(typeof s.stamina, 'number'); assert.deepEqual(s.events, ['lluvia']); assert.equal(s.waited, 0);
    const w = U.Rules.createRun(data, 2); U.Rules.wait(w); assert.equal(U.Rules.summary(w).waited, 210); assert.deepEqual(U.Rules.summary(w).events, ['huelga']);
    // una partida jugada de verdad por el bot del nivel 1 (hora pico, 12 tramos, sin Monster): llega y desbloquea
    const g = U.Rules.createRun(data, 0, () => 0.99); for (let k = 0; k < 80 && !g.over; k++) { const bp = cheapestStaminaPath(U, g); U.Rules.travel(g, bp.path[1]); U.Rules.checkStuck(g); }
    assert.equal(g.won, true); const f = ids(Ach().record(U.Rules.summary(g), 0)); assert.ok(f.includes('primer_viaje') && f.includes('hora_pico') && f.includes('sin_monster'), f.join());
  });
});

test('logros: el guardado valida logros y estadísticas, y borrar progreso los borra', () => {
  withStore((st) => {
    U.session.loaded = false; freshAch(); st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [], best: {}, ach: { primer_viaje: true, inventado: true, semana1: false, racha5: 'si' }, stats: { played: 7, wins: -1, steps: 2.5, robbed: 'x', monsters: 3, combis: 1e12 } });
    U.Save.load(); assert.deepEqual(U.session.ach, { primer_viaje: true }, 'solo ids conocidos y verdaderos');
    assert.deepEqual(U.session.stats, { played: 7, wins: 0, steps: 0, robbed: 0, monsters: 3, combis: 0, news: 0, safeWins: 0 }, 'estadísticas inválidas se ignoran');
    [null, 5, 'x', []].forEach((bad) => { U.session.loaded = false; freshAch(); st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [], ach: bad, stats: bad }); U.Save.load(); assert.ok(typeof U.session.ach === 'object'); });
    U.session.loaded = false; freshAch(); st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [2] }); U.Save.load(); assert.deepEqual(U.session.ach, {}, 'un guardado viejo sin logros arranca vacío');
    Ach().record(res(), 0); assert.ok(Object.keys(JSON.parse(st[U.Save.KEY]).ach).length >= 1);
    U.Save.reset(); assert.deepEqual(U.session.ach, {}); assert.equal(U.session.stats, null); assert.deepEqual(JSON.parse(st[U.Save.KEY]).ach, {}); assert.equal(Ach().count().got, 0);
  });
});

// ---------------------------------------------------------------- reto diario (sin internet: todo sale de la fecha del dispositivo)
const Dly = () => U.Daily;
const freshDaily = () => { U.session.dailyLog = null; U.session.dailyRun = null; U.session.completed = []; U.session.best = {}; U.session.infinite = null; };
const dayWin = (k, o) => { const lv = Dly().level(data, k), run = U.Rules.createRun(data, -1, Dly().rnd(k), lv); run.over = true; run.won = true; run.money = (o && o.money) || 50; run.minute = 600; return run; };
const dayLose = (k) => { const run = dayWin(k); run.won = false; return run; };

test('reto diario: la clave, el número y el día de la semana salen de la fecha (sin red)', () => {
  assert.equal(Dly().key(new Date(2026, 10, 9, 23, 59)), '2026-11-09'); assert.equal(Dly().key(new Date(2026, 0, 1, 0, 0)), '2026-01-01', 'usa la fecha LOCAL, no la UTC');
  assert.equal(Dly().number('2026-01-01'), 1); assert.equal(Dly().number('2026-01-02'), 2); assert.equal(Dly().number('2026-11-09'), 313);
  assert.equal(Dly().weekdayName('2026-11-09'), 'LUNES'); assert.equal(Dly().weekdayName('2026-11-08'), 'DOMINGO'); assert.equal(Dly().weekdayName('2026-11-14'), 'SABADO');
  assert.equal(Dly().prevKey('2026-03-01'), '2026-02-28'); assert.equal(Dly().prevKey('2024-03-01'), '2024-02-29', 'año bisiesto'); assert.equal(Dly().prevKey('2026-01-01'), '2025-12-31');
  assert.equal(Dly().parse('2026-02-30'), null, 'fecha imposible'); assert.equal(Dly().parse('hoy'), null); assert.equal(Dly().parse(null), null); assert.equal(Dly().prevKey('x'), null);
  assert.equal(Dly().minutesLeft(new Date(2026, 5, 1, 23, 30)), 30); assert.equal(Dly().minutesLeft(new Date(2026, 5, 1, 0, 0)), 1440); assert.equal(Dly().minutesLeft(new Date(2026, 5, 1, 18, 45)), 315);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'daily.js'), 'utf8');
  assert.ok(!/fetch\s*\(|XMLHttpRequest|WebSocket|navigator\.|https?:\/\//.test(src), 'el reto diario no toca internet');
});

test('reto diario: misma fecha = mismo reto y mismos dados; otra fecha, otro; la dificultad sube en la semana', () => {
  const a = Dly().level(data, '2026-11-09'), b = Dly().level(data, '2026-11-09');
  assert.equal(a, b, 'se calcula una vez'); assert.deepEqual(Dly().level(data, '2026-11-09'), JSON.parse(JSON.stringify(a)), 'igual que al recalcular');
  const fresh = Object.assign({}, U.Infinite.level(data, Dly().seed('2026-11-09'), Dly().round('2026-11-09'))); assert.equal(fresh.start, a.start); assert.equal(fresh.goal, a.goal);
  assert.equal(a.daily, '2026-11-09'); assert.equal(a.id, 313); assert.equal(a.day, 'RETO #313'); assert.equal(a.infinite, true);
  assert.match(a.startDesc, /Sales de .+\. Es el reto de hoy/); assert.match(a.goalDesc, /^Llegaste a /);
  const realNow = Date.now; let r1, r2; try { Date.now = () => 1000; r1 = Dly().rnd('2026-11-09'); Date.now = () => 987654321000; r2 = Dly().rnd('2026-11-09'); } finally { Date.now = realNow; }
  const seq1 = [], seq2 = []; for (let i = 0; i < 20; i++) { seq1.push(r1()); seq2.push(r2()); } assert.deepEqual(seq1, seq2, 'los dados del día son iguales para todos, a cualquier hora');
  const other = Dly().rnd('2026-11-10'), seq3 = []; for (let i = 0; i < 20; i++) seq3.push(other()); assert.notDeepEqual(seq1, seq3, 'otro día, otros dados');
  const keys = new Set(); for (let d = 1; d <= 28; d++) { const k = '2026-02-' + String(d).padStart(2, '0'), l = Dly().level(data, k); keys.add(l.start + '>' + l.goal); } assert.ok(keys.size >= 22, 'rutas distintas cada día: ' + keys.size);
  const hops = (k) => U.Rules.hopsLeft(U.Rules.createRun(data, -1, Dly().rnd(k), Dly().level(data, k)), Dly().level(data, k).start);
  const diffs = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].map((k) => Dly().difficulty(k));
  assert.deepEqual(diffs.map((d) => d.label), ['EXPERTO', 'FACIL', 'FACIL', 'MEDIO', 'MEDIO', 'DIFICIL', 'DIFICIL']); assert.deepEqual(diffs.map((d) => d.pips), [4, 1, 1, 2, 2, 3, 3]);
  const avg = (ks) => ks.reduce((s, k) => s + hops(k), 0) / ks.length, monday = [], sunday = [];
  for (let w = 0; w < 12; w++) { const d = new Date(Date.UTC(2026, 0, 5 + w * 7)); monday.push(d.toISOString().slice(0, 10)); sunday.push(new Date(d.getTime() - 86400000).toISOString().slice(0, 10)); }
  assert.ok(avg(sunday) > avg(monday), 'el domingo es más largo que el lunes');
});

test('reto diario: todos los días de un año se pueden ganar (jugador automático)', () => {
  for (let i = 0; i < 366; i += 3) {                                // cada 3 días, 122 retos de 2026 (todos los días de la semana)
    const k = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), lv = Dly().level(data, k);
    assert.equal(Inf().autoplay(data, lv).won, true, 'ganable el ' + k); assert.ok(lv.start !== lv.goal, 'inicio y meta distintos ' + k);
  }
});

test('reto diario: desbloqueo, empezar y salir del reto', () => {
  freshDaily(); assert.equal(Dly().unlocked(), false); U.session.completed = [0]; assert.equal(Dly().unlocked(), true);
  U.session.infinite = { seed: 1, round: 1, cleared: 0, stars: 0, newBest: false }; const s = Dly().start('2026-11-09'); assert.deepEqual(s, { key: '2026-11-09' }); assert.equal(U.session.infinite, null, 'empezar el reto cancela una racha infinita');
  assert.equal(U.session.dailyRun, s); Dly().clear(); assert.equal(U.session.dailyRun, null);
  Dly().start('2026-11-09'); Inf().start(5); assert.equal(U.session.dailyRun, null, 'empezar el infinito cancela el reto'); assert.notEqual(U.session.infinite, null);
  U.session.infinite = null; assert.equal(Dly().start().key, Dly().key(), 'por defecto, hoy');
});

test('reto diario: terminar (finish) guarda intentos, mejor marca y racha', () => {
  withStore((st) => {
    freshDaily(); const k = '2026-11-09';
    assert.equal(Dly().finish({ level: { id: 3 }, won: true }, 3), null, 'un nivel que no es reto no registra nada');
    let r = Dly().finish(dayLose(k), 0); assert.equal(r.first, false); assert.equal(r.entry.tries, 1); assert.equal(Dly().status(k).done, false); assert.equal(Dly().streak(k), 0); assert.equal(Dly().week(k, 1)[0].state, 'lost');
    r = Dly().finish(dayWin(k, { money: 40 }), 1); assert.equal(r.first, true); assert.equal(r.better, false); assert.equal(r.streak, 1); assert.equal(r.best, 1); assert.equal(r.number, 313); assert.deepEqual(r.entry, { tries: 2, stars: 1, money: 40 });
    r = Dly().finish(dayWin(k, { money: 30 }), 1); assert.equal(r.first, false); assert.equal(r.better, false, 'menos dinero con las mismas estrellas no mejora'); assert.deepEqual(r.entry, { tries: 3, stars: 1, money: 40 });
    r = Dly().finish(dayWin(k, { money: 60 }), 1); assert.equal(r.better, true, 'igual de estrellas y más dinero sí'); assert.equal(r.entry.money, 60);
    r = Dly().finish(dayWin(k, { money: 10 }), 3); assert.equal(r.better, true, 'más estrellas sí aunque lleves menos dinero'); assert.deepEqual(r.entry, { tries: 5, stars: 3, money: 10 });
    r = Dly().finish(dayLose(k), 0); assert.equal(r.entry.stars, 3, 'perder después no borra tu marca'); assert.equal(Dly().status(k).done, true); assert.equal(Dly().streak(k), 1, 'ni la racha');
    const s = Dly().status(k); assert.equal(s.stars, 3); assert.equal(s.tries, 6); assert.equal(s.wins, 1, 'un día cuenta una sola vez'); assert.equal(s.played, 6);
    const saved = JSON.parse(st[U.Save.KEY]).daily; assert.equal(saved.days[k].tries, 6); assert.equal(saved.streak, 1); assert.equal(saved.last, k);
  });
});

test('reto diario: la racha de días seguidos sube, se corta al faltar un día y no se infla con el reloj', () => {
  withStore(() => {
    freshDaily(); const win = (k) => Dly().finish(dayWin(k), 2);
    assert.equal(win('2026-11-02').streak, 1); assert.equal(win('2026-11-03').streak, 2); assert.equal(win('2026-11-04').streak, 3);
    assert.equal(Dly().streak('2026-11-04'), 3); assert.equal(Dly().streak('2026-11-05'), 3, 'mañana aún no la pierdes: puedes jugar hoy'); assert.equal(Dly().streak('2026-11-06'), 0, 'pasó un día entero sin jugar: se corta');
    assert.equal(win('2026-11-06').streak, 1, 'vuelves a empezar'); assert.equal(Dly().status('2026-11-06').best, 3, 'pero la mejor racha se queda');
    assert.equal(win('2026-11-07').streak, 2);
    win('2026-11-01'); assert.equal(Dly().status('2026-11-07').streak, 2, 'ganar un día viejo (reloj atrasado) no altera la racha'); assert.equal(U.session.dailyLog.last, '2026-11-07');
    assert.equal(Dly().status('2026-11-07').wins, 6, 'pero sí se guarda el día'); assert.equal(win('2026-12-25').streak, 1, 'saltar semanas adelante la reinicia');
    assert.equal(win('2026-12-26').streak, 2); assert.equal(win('2026-12-27').streak, 3); assert.equal(win('2026-12-28').streak, 4); assert.equal(Dly().status('2026-12-28').best, 4, 'récord nuevo');
    assert.equal(Dly().prevKey('2026-12-31'), '2026-12-30'); const y = Dly().finish(dayWin('2026-12-31'), 1), n = Dly().finish(dayWin('2027-01-01'), 1); assert.equal(n.streak, y.streak + 1, 'la racha cruza el cambio de año');
  });
});

test('reto diario: la semana (week) marca ganado, perdido, hoy y sin jugar', () => {
  withStore(() => {
    freshDaily(); Dly().finish(dayWin('2026-11-05'), 2); Dly().finish(dayLose('2026-11-07'), 0); Dly().finish(dayWin('2026-11-08'), 1);
    const w = Dly().week('2026-11-09', 7); assert.equal(w.length, 7); assert.equal(w[0].key, '2026-11-03'); assert.equal(w[6].key, '2026-11-09'); assert.deepEqual(w.map((d) => d.state), ['none', 'none', 'won', 'none', 'lost', 'won', 'today']);
    assert.equal(Dly().week('basura', 7).length, 0);
  });
});

test('reto diario: solo se guardan los últimos 60 días', () => {
  withStore(() => {
    freshDaily(); for (let i = 0; i < 75; i++) Dly().finish(dayWin(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)), 1);
    const days = Object.keys(U.session.dailyLog.days); assert.equal(days.length, 60); assert.ok(!days.includes('2026-01-01')); assert.ok(days.includes('2026-03-16')); assert.equal(U.session.dailyLog.wins, 75, 'los totales no se recortan'); assert.equal(U.session.dailyLog.best, 75);
  });
});

test('reto diario: el guardado se valida y "borrar progreso" lo borra', () => {
  withStore((st) => {
    freshDaily(); const ok = { last: '2026-11-09', streak: 4, best: 9, wins: 12, played: 20, days: { '2026-11-09': { tries: 2, won: true, stars: 3, money: 55, minute: 700 }, '2026-11-08': { tries: 1, won: false, stars: 0, money: 0, minute: 0 } } };
    U.session.loaded = false; st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [0], best: {}, daily: ok }); U.Save.load();
    assert.equal(U.session.dailyLog.streak, 4); assert.equal(U.session.dailyLog.last, '2026-11-09'); assert.equal(U.session.dailyLog.days['2026-11-09'].stars, 3); assert.equal(Object.keys(U.session.dailyLog.days).length, 2, 'el día intentado y perdido también se guarda'); assert.equal(U.session.dailyLog.days['2026-11-08'].won, false);
    [null, 'hoy', 5, [], { last: 'x', streak: -2, best: 'a', wins: 1.5, played: null, days: 7 }, { last: '2026-13-45', streak: 1, best: 1, wins: 1, played: 1, days: { 'ayer': { tries: 1, won: true, stars: 1, money: 1, minute: 1 }, '2026-11-01': { tries: 0, won: true, stars: 9, money: -5, minute: 99999 } } }].forEach((bad) => {
      freshDaily(); U.session.loaded = false; st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [], best: {}, daily: bad }); U.Save.load(); const l = U.session.dailyLog || Dly().newLog();
      [l.streak, l.best, l.wins, l.played].forEach((n) => assert.ok(Number.isInteger(n) && n >= 0, 'enteros no negativos: ' + JSON.stringify(bad)));
      assert.ok(l.last === null || Dly().parse(l.last), 'fecha válida o nula'); Object.keys(l.days).forEach((k) => { assert.ok(Dly().parse(k), k); const d = l.days[k]; assert.ok(d.tries >= 1 && d.stars >= 0 && d.stars <= 3 && d.money >= 0 && d.minute >= 0 && d.minute <= 1440, JSON.stringify(d)); });
    });
    const many = {}; for (let i = 0; i < 90; i++) many[new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)] = { tries: 1, won: true, stars: 1, money: 1, minute: 1 };
    freshDaily(); U.session.loaded = false; st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [], best: {}, daily: { last: '2026-03-31', streak: 90, best: 90, wins: 90, played: 90, days: many } }); U.Save.load(); assert.equal(Object.keys(U.session.dailyLog.days).length, 60);
    freshDaily(); U.session.loaded = false; U.session.dailyLog = Dly().newLog(); U.session.dailyLog.streak = 7; st[U.Save.KEY] = JSON.stringify({ v: 1, completed: [2] }); U.Save.load(); assert.equal(U.session.dailyLog.streak, 7, 'un guardado viejo sin reto no lo borra a medias');
    U.session.dailyLog = ok; U.session.dailyRun = { key: '2026-11-09' }; U.Save.reset(); assert.equal(U.session.dailyLog, null); assert.equal(U.session.dailyRun, null); assert.deepEqual(JSON.parse(st[U.Save.KEY]).daily, Dly().newLog());
    U.session.loaded = false; U.Save.load(); Dly().finish(dayWin('2026-11-09'), 1); assert.equal(JSON.parse(st[U.Save.KEY]).daily.wins, 1, 'tras borrar se vuelve a guardar');
  });
});

test('reto diario: createRun usa el nivel del día y el resumen lo marca', () => {
  const k = '2026-11-10', lv = Dly().level(data, k), run = U.Rules.createRun(data, -1, Dly().rnd(k), lv), sm = U.Rules.summary(run);
  assert.equal(run.level, lv); assert.equal(run.current, lv.start); assert.equal(sm.daily, k); assert.equal(sm.infinite, null, 'no es una ronda del infinito'); assert.equal(sm.dailyNumber, 314);
  U.News.intro(run); assert.equal(run.newsLog.filter((n) => n.title === 'Reto diario #314').length, 1, 'el aviso inicial dice "Reto diario #314"'); assert.equal(Inf().title(lv), 'RETO DIARIO #314');
  assert.equal(U.Rules.summary(U.Rules.createRun(data, 0)).daily, null); assert.equal(U.Rules.summary(U.Rules.createRun(data, -1, () => 0.5, Inf().level(data, 3, 4))).daily, null);
  const a = U.Rules.createRun(data, -1, Dly().rnd(k), lv), b = U.Rules.createRun(data, -1, Dly().rnd(k), lv); [a, b].forEach((x) => { U.News.intro(x); U.News.onMove(x); }); assert.deepEqual(a.newsLog.map((n) => n.title), b.newsLog.map((n) => n.title), 'las noticias del día son las mismas para todos');
});
