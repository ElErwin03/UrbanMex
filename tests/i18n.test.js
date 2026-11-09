const test = require('node:test'), assert = require('node:assert');
const { loadModules, rawData, cheapestStaminaPath, wantsWait } = require('./helpers');
const U = loadModules(['core', 'data', 'graph', 'events', 'rules', 'news', 'infinite', 'achievements', 'i18n', 'lang-en', 'lang-en-data', 'lang-en-play', 'lang-en-ui']);
const data = U.Data.normalize(rawData());
const I = U.I18n;
U.session.lang = 'es';
const holes = (s) => (s.match(/\{\d\}/g) || []).sort().join('');

/** Todos los textos que el juego fabrica (sin pasar por la interfaz) en partidas de bot, pruebas de reglas y catálogo. */
function collectTexts() {
  const seen = new Set(), add = (s) => { if (typeof s === 'string' && s.trim()) seen.add(s); };
  const run0 = (idx, seed, lv) => { const run = U.Rules.createRun(data, idx, U.util.seeded(seed), lv); U.News.intro(run); return run; };
  const grab = (run) => {
    add(run.level.day); add(run.level.startDesc); add(run.level.goalDesc); add(U.Infinite.title(run.level)); (run.newsLog || []).forEach((n) => { add(n.title); add(n.desc); add(n.impact); });
    U.Events.status(run).forEach((e) => { add(e.label); add(e.text); }); U.Events.list(run).forEach((e) => ['start', 'end', 'now', 'soon'].forEach((k) => { const t = U.Events.text(run, e, k); add(t.title); add(t.desc); add(t.impact); }));
    ['night', 'stamina', 'money', 'blocked'].forEach((r) => add(({ night: 'Anocheció y no llegaste a tiempo.', stamina: 'Te quedaste sin stamina.', money: 'Te quedaste sin dinero.', blocked: 'Todas las rutas están bloqueadas.' })[r]));
    U.Graph.neighbors(run.graph, run.current).forEach((n) => { const x = U.Rules.explain(run, n); if (x) { add(x.short); add(x.detail); } });
    [false, true].forEach((combi) => U.Events.effects(run, { combi: combi }).forEach(add));
  };
  data.levels.forEach((lv, i) => { for (let seed = 1; seed <= 4; seed++) {
    const run = run0(i, seed); grab(run);
    let guard = 300; while (!run.over && guard--) {
      U.News.onMove(run); grab(run);
      if (wantsWait(U, run) && U.Rules.wait(run).ok) continue;
      const bp = cheapestStaminaPath(U, run); if (!bp) { U.Rules.wait(run); continue; }
      if (seed === 3) { run.stamina = Math.min(run.stamina, 2); run.money = seed === 3 ? Math.min(run.money, 40) : run.money; }   // para provocar los avisos de "te faltan..."
      if (seed === 4) run.minute = Math.max(run.minute, 1150);
      if (data.stations[run.current].shop && run.stamina < bp.need) while (U.Rules.buyMonster(run).ok && run.stamina < bp.need) {}
      const out = U.Rules.travel(run, bp.path[1]); if (!out.ok) { grab(run); break; } if (out.type !== 'goal') U.Rules.checkStuck(run);
      if (run.over) add(run.endReason);
    }
    grab(run);
  } });
  for (let r = 1; r <= 14; r++) { const lv = U.Infinite.level(data, 7, r); const run = U.Rules.createRun(data, -1, U.util.seeded(r), lv); U.News.intro(run); grab(run); }
  U.Achievements.LIST.forEach((a) => { add(a.name); add(a.desc); });
  U.Achievements.GROUPS.forEach((g) => add(g[1]));
  return [...seen];
}

test('el diccionario inglés es coherente: mismos huecos, nada vacío, sin ¿ ni ¡', () => {
  const es = I.entries('en'); assert.ok(es.length > 400, 'hay diccionario: ' + es.length);
  es.forEach(([k, v]) => {
    assert.ok(typeof v === 'string' && v.trim(), 'traducción vacía: ' + k);
    assert.equal(holes(v), holes(k), 'los huecos de "' + k + '" y de "' + v + '" no coinciden');
    assert.ok(!/[¿¡]/.test(v), 'el inglés no lleva ¿ ¡: ' + v);
  });
});

test('en español (por defecto) nada cambia', () => {
  U.session.lang = 'es'; I.reset();
  ['JUGAR', 'NIVEL {0}', 'Llegaste a la escuela'].forEach((s) => assert.equal(I.tr(s), s)); assert.equal(I.lang(), 'es'); assert.deepEqual(I.misses(), []);
});

test('traducciones exactas y con huecos (los huecos se traducen solos y los nombres propios se quedan)', () => {
  U.session.lang = 'en'; I.reset();
  assert.equal(I.tr('JUGAR'), 'PLAY'); assert.equal(I.tr('NIVEL 6 - LUNES 2'), 'LEVEL 6 - MONDAY 2'); assert.equal(I.tr('RONDA 3'), 'ROUND 3');
  assert.equal(I.tr('Sales de Tacuba. Hoy te toca una ruta nueva.'), 'You leave from Tacuba. Today you get a new route.');
  assert.equal(I.tr('AHORA: 9:30 AM'), 'NOW: 9:30 AM', 'las horas no se tocan'); assert.equal(I.tr('7:00 AM'), '7:00 AM'); assert.equal(I.tr('123'), '123'); assert.equal(I.tr('$40'), '$40');
  assert.equal(I.tr('LOGROS 3/23'), 'ACHIEVEMENTS 3/23'); assert.equal(I.tr('Mejor racha: 1 ronda'), 'Best streak: 1 round');
  assert.equal(I.tr('Te faltan 3 de stamina'), 'You are 3 stamina short'); assert.equal(I.tr('Te faltan 5 peje-coins'), 'You are 5 peje-coins short');
  assert.deepEqual(I.misses(), [], 'nada de esto debe quedar sin traducir');
  // lo que no tiene traducción se queda igual y se anota; varias líneas se traducen una por una; lo ya traducido no se vuelve a anotar
  assert.equal(I.tr('Frase que no existe'), 'Frase que no existe'); assert.deepEqual(I.misses(), ['Frase que no existe']);
  assert.equal(I.tr('JUGAR\nSALIR'), 'PLAY\nQUIT'); assert.equal(I.tr('PLAY'), 'PLAY'); I.clearMisses(); assert.deepEqual(I.misses(), []);
  U.session.lang = 'es';
});

test('con varias plantillas parecidas gana la más específica (sin importar el orden en que se agregaron)', () => {
  I.add('zz', { 'Hola {0}': 'Hi {0}', 'Hola {0} y {1}': 'Hi {0} and {1}', 'Hola': 'Hello' });
  assert.equal(I.lookup('zz', 'Hola Ana y Bob'), 'Hi Ana and Bob'); assert.equal(I.lookup('zz', 'Hola Ana'), 'Hi Ana'); assert.equal(I.lookup('zz', 'Hola'), 'Hello'); assert.equal(I.lookup('zz', 'Adios'), null);
});

test('los nombres de estaciones nunca se traducen ni se anotan como faltantes', () => {
  U.session.lang = 'en'; I.reset(); data.stationList.forEach((s) => { assert.equal(I.tr(s.id), s.id); assert.ok(I.known(s.id), s.id); }); assert.deepEqual(I.misses(), []); U.session.lang = 'es';
});

test('util.wrap traduce el párrafo ANTES de partirlo y las líneas resultantes no se vuelven a anotar', () => {
  U.session.lang = 'en'; I.reset();
  const lines = U.util.wrap('Toca una estación conectada a la tuya: las vecinas se iluminan en el mapa.', 24);
  assert.equal(lines.join(' '), 'Tap a station connected to yours: neighbors light up on the map.'); assert.ok(lines.length > 1 && lines.every((l) => l.length <= 24));
  lines.forEach((l) => assert.equal(I.tr(l), l)); assert.deepEqual(I.misses(), []);
  U.session.lang = 'es'; assert.equal(U.util.wrap('Hola mundo', 24).join(' '), 'Hola mundo');
});

test('inglés: TODO lo que fabrican las reglas, las noticias, los eventos y los logros tiene traducción', () => {
  U.session.lang = 'en'; I.reset();
  const texts = collectTexts(); assert.ok(texts.length > 150, 'se juntaron textos: ' + texts.length);
  const missing = texts.filter((t) => !I.known(t)); assert.deepEqual(missing, [], 'sin traducir (' + missing.length + ')');
  U.session.lang = 'es';
});

test('el idioma se guarda y se valida al cargar', () => {
  const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  try {
    U.session.lang = 'es'; I.setLang('en'); assert.equal(I.lang(), 'en'); assert.equal(JSON.parse(store['UrbanMex_save_v1']).lang, 'en');
    U.session.lang = 'es'; U.session.loaded = false; U.Save.load(); assert.equal(I.lang(), 'en', 'se recupera al cargar');
    store['UrbanMex_save_v1'] = JSON.stringify({ v: 1, lang: 'fr' }); U.session.lang = 'es'; U.session.loaded = false; U.Save.load(); assert.equal(I.lang(), 'es', 'un idioma desconocido se ignora'); assert.equal(U.session.lang, 'es', 'y no se queda guardado en la sesión');
    I.setLang('xx'); assert.equal(I.lang(), 'es'); U.Save.reset(); I.setLang('en'); U.Save.reset(); assert.equal(I.lang(), 'en', 'BORRAR PROGRESO no cambia el idioma');
  } finally { delete globalThis.localStorage; U.session.lang = 'es'; }
});
