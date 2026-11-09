#!/usr/bin/env node
/* Lista los textos en español que el juego puede mostrar y que todavía no tienen traducción al inglés:
 *   node tools/i18n_scan.js [--all]
 * Fuentes: los textos entre comillas de src/*.js (los que parecen texto para mostrar) y los campos de texto de los JSON de data. Aproximado: sirve para
 * no olvidar nada al traducir; la prueba de pantallas (tests) es la que exige que no falte ninguno de lo que de verdad se dibuja. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), all = process.argv.includes('--all');
const g = { gdjs: { UrbanMex: { session: {} } }, console }; vm.createContext(g);
['core', 'i18n'].concat(fs.readdirSync(path.join(root, 'src')).filter((f) => /^lang-/.test(f)).map((f) => f.replace('.js', ''))).forEach((m) => vm.runInContext(fs.readFileSync(path.join(root, 'src', m + '.js'), 'utf8'), g));
const I = g.gdjs.UrbanMex.I18n; g.gdjs.UrbanMex.session.lang = 'en';
const stations = JSON.parse(fs.readFileSync(path.join(root, 'My project', 'data', 'estaciones.json'), 'utf8')); I.keep(stations.stations.map((s) => s.id));
const have = (s) => I.known(s);
const found = new Map();
const note = (s, where) => { s = s.replace(/\\'/g, "'").replace(/\\n/g, '\n'); if (!found.has(s)) found.set(s, where); };
const looksLikeText = (s) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/.test(s) && (/\s/.test(s) || /^[A-ZÁÉÍÓÚÑ]{4,}$/.test(s)) && !/^[\w.:#;\/\-]+$/.test(s) && !/^\d/.test(s) && !/=>|function|\bvar\b|\breturn\b/.test(s) && !/^[a-z]+[A-Z]/.test(s);
fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js') && !/^(lang-|i18n)/.test(f)).forEach((f) => {
  const src = fs.readFileSync(path.join(root, 'src', f), 'utf8').split('\n');
  src.forEach((line, i) => { const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''); let m; const re = /'((?:[^'\\\n]|\\.)*)'/g;
    while ((m = re.exec(code))) if (looksLikeText(m[1])) note(m[1], f + ':' + (i + 1)); });
});
const dataDir = path.join(root, 'My project', 'data'), strs = (o, w) => { if (typeof o === 'string') { if (/[A-Za-z]{3}/.test(o) && /\s|^[A-ZÁÉÍÓÚÑ ]{4,}$/.test(o)) note(o, w); } else if (o && typeof o === 'object') Object.keys(o).forEach((k) => { if (!/^(id|type|icon|severity|from|to|line|effects|name|stations|color|colorName)$/.test(k) || k === 'name') strs(o[k], w); }); };
['noticias', 'niveles', 'config'].forEach((n) => strs(JSON.parse(fs.readFileSync(path.join(dataDir, n + '.json'), 'utf8')), 'data/' + n));
const miss = [...found].filter(([s]) => all || !have(s));
miss.forEach(([s, w]) => console.log(w + '\t' + JSON.stringify(s)));
console.error(miss.length + ' sin traducir de ' + found.size + ' textos');
