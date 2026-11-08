// Carga los módulos puros de src/ en un contexto global falso de GDevelop y expone los datos reales.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'My project', 'data');

function loadModules(names) {
  globalThis.gdjs = {};
  names.forEach((n) => vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src', n + '.js'), 'utf8'), { filename: n + '.js' }));
  return globalThis.gdjs.UrbanMex;
}
function rawData() {
  const j = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  return { config: j('config.json'), stations: j('estaciones.json'), connections: j('conexiones.json'),
           levels: j('niveles.json'), news: j('noticias.json') };
}
/** Camino que menos stamina gasta (cuenta las combis con su tarifa real) y la stamina total que pide. Lo usan los bots de prueba. */
function cheapestStaminaPath(U, run) {
  const cfg = run.data.config, G = U.Graph, dist = { [run.current]: 0 }, prev = {}, done = {};
  for (;;) {
    let u = null; Object.keys(dist).forEach((k) => { if (!done[k] && (u === null || dist[k] < dist[u])) u = k; });
    if (u === null) return null;
    if (u === run.level.goal) break;
    done[u] = true;
    G.neighbors(run.graph, u).forEach((v) => {
      if (run.blocked[v] || done[v]) return;
      const fare = G.isCombi(run.graph, u, v) ? G.fare(run.graph, u, v) : null;
      const w = dist[u] + (fare ? (fare.stamina !== undefined ? fare.stamina : cfg.combi.stamina) : cfg.staminaPerStation) + 0.001;   // el 0.001 desempata a favor de menos tramos
      if (dist[v] === undefined || w < dist[v]) { dist[v] = w; prev[v] = u; }
    });
  }
  const path = [run.level.goal]; while (prev[path[0]] !== undefined) path.unshift(prev[path[0]]);
  let need = Math.round(dist[run.level.goal]);
  if (U.Events) {                                            // los eventos del día (lluvia, hora pico) suman stamina y tiempo según la hora de cada salida
    const sim = { data: run.data, level: run.level, minute: run.minute };
    for (let k = 0; k + 1 < path.length; k++) {
      const combi = G.isCombi(run.graph, path[k], path[k + 1]), ex = U.Events.hopExtra(sim, combi);
      need += ex.stamina; sim.minute += U.Rules.edgeCost(run, path[k], path[k + 1]) + ex.time;
    }
  }
  return { path, need };
}

/** ¿Le conviene esperar a que reabra una línea en huelga? Sí si sin ruta, o si con la línea abierta ahorraría 20+ de stamina (el rodeo no vale la pena). Lo usan los bots de prueba. */
function wantsWait(U, run) {
  if (!U.Events) return false;
  const ends = U.Events.strikeEnds(run); if (!ends.length) return false;
  const now = cheapestStaminaPath(U, run); if (!now) return true;
  const later = Object.assign({}, run, { minute: Math.min(...ends), blocked: Object.assign({}, run.blocked), striking: Object.assign({}, run.striking), eventQueue: [] });
  U.Rules.syncEvents(later); const lp = cheapestStaminaPath(U, later);
  return !!lp && now.need - lp.need >= 20 && Math.min(...ends) <= run.data.config.dayEndMinute - 240;
}

module.exports = { loadModules, rawData, ROOT, DATA, cheapestStaminaPath, wantsWait };
