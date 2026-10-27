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
module.exports = { loadModules, rawData, ROOT, DATA };
