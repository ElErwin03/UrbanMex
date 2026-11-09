/* UrbanMex · i18n — IDIOMAS: español (el original) e inglés (puro, sin motor).
 *
 * Todo el texto del juego está escrito en español en el código y los datos; la traducción se hace en UN solo punto, al dibujarlo (ui.text, ui.button, ui.lines)
 * y antes de partir un párrafo en líneas (util.wrap), con un diccionario `español → inglés`:
 *   · entradas exactas:       'JUGAR': 'PLAY'
 *   · plantillas con huecos:   'NIVEL {0} - {1}': 'LEVEL {0} - {1}'  (los huecos {0}, {1}... se traducen solos: 'LUNES' → 'MONDAY'; los nombres de estaciones se quedan)
 * Lo que no tiene traducción se queda en español y se anota en `misses` (las pruebas exigen que no haya ninguno en ninguna pantalla).
 * El idioma vive en U.session.lang ('es' | 'en') y se guarda con U.Save. Agregar uno nuevo es agregar un diccionario con I18n.add(lang, {...}). */
(function () {
  var U = gdjs.UrbanMex;
  if (U.I18n) return;

  var LANGS = [['es', 'ESPANOL'], ['en', 'ENGLISH']];
  var dict = {}, cache = {}, cacheN = 0, outs = {}, misses = {};
  var KEEP = [/^[^A-Za-zÀ-ÿ]*$/, /^[A-Z]{2,4}$/, /^\d+(?::\d\d)?\s?(AM|PM)?$/];     // sin letras (números, símbolos), siglas (LTE) y horas: no se traducen
  var proper = {};                                                                                 // nombres propios que se quedan igual (estaciones, ENGLISH / ESPANOL...)
  LANGS.forEach(function (l) { proper[l[1]] = true; });

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function compile(key) {
    var holes = 0, re = escapeRe(key).replace(/\\\{(\d)\\\}/g, function (m, n) { holes++; return '(.+?)'; });
    return { re: new RegExp('^' + re + '$'), lit: key.replace(/\{\d\}/g, '').length, holes: holes };
  }

  /** Añade (o amplía) el diccionario de un idioma: { 'español': 'inglés' }. Las claves con {0}, {1}... son plantillas. */
  function add(lang, map) {
    var d = dict[lang] || (dict[lang] = { exact: {}, tpl: [] });
    Object.keys(map).forEach(function (k) {
      if (/\{\d\}/.test(k)) { var c = compile(k); c.to = map[k]; c.key = k; d.tpl.push(c); }
      else d.exact[k] = map[k];
    });
    d.tpl.sort(function (a, b) { return b.lit - a.lit; });                         // la plantilla más específica primero
    cache = {}; cacheN = 0;
  }

  function keepAsIs(s) { return KEEP.some(function (re) { return re.test(s); }) || proper[s] === true; }

  /** Traduce `s` a `lang` o devuelve null si no hay traducción (sin anotar nada). */
  function lookup(lang, s) {
    var d = dict[lang]; if (!d) return null;
    if (Object.prototype.hasOwnProperty.call(d.exact, s)) return d.exact[s];
    for (var i = 0; i < d.tpl.length; i++) {
      var t = d.tpl[i], m = t.re.exec(s); if (!m) continue;
      return t.to.replace(/\{(\d)\}/g, function (x, n) { var v = m[+n + 1]; var tr = v === undefined ? '' : lookup(lang, v); return tr === null ? (v === undefined ? '' : v) : tr; });
    }
    return null;
  }

  var I18n = {
    LANGS: LANGS, add: add, lookup: lookup,
    /** Idioma activo: 'es' o 'en'. */
    lang: function () { return U.session.lang === 'en' ? 'en' : 'es'; },
    setLang: function (l) { U.session.lang = l === 'en' ? 'en' : 'es'; cache = {}; cacheN = 0; U.Save.persist(); },
    /** Nombres que no se traducen (estaciones, etc.): ['Tacuba', ...]. */
    keep: function (list) { list.forEach(function (n) { proper[n] = true; }); },
    /** ¿Tiene traducción (o no hace falta traducirlo)? */
    known: function (s, lang) { return keepAsIs(String(s)) || lookup(lang || 'en', String(s)) !== null; },
    /** El texto en el idioma activo. Lo que ya está en inglés (o no tiene traducción) se devuelve igual. */
    tr: function (s) {
      if (U.session.lang !== 'en' || s === undefined || s === null) return s;
      s = String(s); var hit = cache[s]; if (hit !== undefined) return hit;
      var out;
      if (outs[s] || keepAsIs(s)) out = s;
      else {
        var r = lookup('en', s);
        if (r === null) {                                                                // varias líneas: se traduce cada una
          if (s.indexOf('\n') > 0) out = s.split('\n').map(function (l) { return I18n.tr(l); }).join('\n');
          else { misses[s] = true; out = s; }
        } else out = r;
      }
      outs[out] = true; if (++cacheN > 4000) { cache = {}; cacheN = 0; } cache[s] = out; return out;
    },
    /** Anota líneas ya partidas (para que ui.text no las dé por faltantes). */
    mark: function (lines) { if (U.session.lang === 'en') lines.forEach(function (l) { outs[l] = true; }); return lines; },
    /** Textos que se pidieron sin traducción (para las pruebas). */
    misses: function () { return Object.keys(misses); },
    clearMisses: function () { misses = {}; },
    /** Todas las entradas del diccionario de un idioma (para las pruebas). */
    entries: function (lang) { var d = dict[lang] || { exact: {}, tpl: [] }; return Object.keys(d.exact).map(function (k) { return [k, d.exact[k]]; }).concat(d.tpl.map(function (t) { return [t.key, t.to]; })); },
    reset: function () { cache = {}; cacheN = 0; outs = {}; misses = {}; }
  };
  U.I18n = I18n;
})();
