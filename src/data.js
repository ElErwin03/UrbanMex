/* UrbanMex · data — carga y normaliza los JSON del juego (recursos "data/*.json" del proyecto).
 * Editar estaciones, niveles, noticias o economía = editar esos JSON, no el código. */
(function () {
  var U = gdjs.UrbanMex;
  if (U.Data) return;

  var RES = {
    config: 'data/config.json', stations: 'data/estaciones.json', connections: 'data/conexiones.json',
    levels: 'data/niveles.json', news: 'data/noticias.json'
  };
  var cache = null, requested = false;

  /** raw = { config, stations:{lines,stations[]}, connections:[[a,b,cost]], levels[], news[] } */
  function normalize(raw) {
    var cfg = raw.config, stations = {}, list = [];
    raw.stations.stations.forEach(function (s) {
      var st = { id: s.id, x: s.x, y: s.y, line: String(s.line), shop: !!s.shop, transfer: false,
                 color: raw.stations.lines[String(s.line)].color };
      stations[st.id] = st; list.push(st);
    });
    var conns = raw.connections.map(function (c) {
      if (!stations[c[0]] || !stations[c[1]]) throw new Error('Conexión con estación inexistente: ' + c[0] + ' - ' + c[1]);
      var isTransfer = c[2] >= cfg.transferTime;
      if (isTransfer) { stations[c[0]].transfer = true; stations[c[1]].transfer = true; }
      return { a: c[0], b: c[1], cost: c[2], transfer: isTransfer };
    });
    raw.levels.forEach(function (l) {
      [l.start, l.goal].concat(l.blocked).forEach(function (n) {
        if (!stations[n]) throw new Error('Nivel ' + l.id + ' usa una estación inexistente: ' + n);
      });
    });
    return { config: cfg, lines: raw.stations.lines, stations: stations, stationList: list,
             connections: conns, levels: raw.levels, news: raw.news };
  }

  U.Data = {
    RESOURCES: RES,
    normalize: normalize,
    /** Devuelve los datos listos, o null mientras los JSON todavía se están cargando. */
    ready: function (runtimeScene) {
      if (cache) return cache;
      var jm = runtimeScene.getGame().getJsonManager(), raw = {}, missing = false;
      Object.keys(RES).forEach(function (k) {
        var j = jm.getLoadedJson(RES[k]);
        if (j) raw[k] = j; else missing = true;
      });
      if (!missing) { cache = normalize(raw); return cache; }
      if (!requested) {           // por si el recurso no se precargó al iniciar el juego
        requested = true;
        Object.keys(RES).forEach(function (k) { if (!jm.isJsonLoaded(RES[k])) jm.loadJson(RES[k], function () {}); });
      }
      return null;
    },
    _setForTests: function (raw) { cache = normalize(raw); return cache; }
  };
})();
