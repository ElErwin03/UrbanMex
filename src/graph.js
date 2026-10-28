/* UrbanMex · graph — red del Metro (puro, sin motor). */
(function () {
  var U = gdjs.UrbanMex;
  if (U.Graph) return;

  function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  U.Graph = {
    key: key,
    build: function (data) {
      var adj = {}, base = {}, combi = {};
      data.stationList.forEach(function (s) { adj[s.id] = []; });
      data.connections.forEach(function (c) {
        adj[c.a].push(c.b); adj[c.b].push(c.a); base[key(c.a, c.b)] = c.cost; if (c.combi) combi[key(c.a, c.b)] = true;
      });
      return { adj: adj, base: base, combi: combi };
    },
    neighbors: function (g, id) { return g.adj[id] || []; },
    connected: function (g, a, b) { return g.base[key(a, b)] !== undefined; },
    baseCost: function (g, a, b) { return g.base[key(a, b)]; },
    /** ¿El tramo a-b es una ruta de combi (y no el Metro)? */
    isCombi: function (g, a, b) { return !!g.combi[key(a, b)]; },
    /** ¿Se puede llegar de `from` a `to` sin pasar por estaciones bloqueadas? */
    reachable: function (g, from, to, blocked) {
      if (blocked[to]) return false;
      var seen = {}, stack = [from]; seen[from] = true;
      while (stack.length) {
        var u = stack.pop();
        if (u === to) return true;
        g.adj[u].forEach(function (v) { if (!seen[v] && !blocked[v]) { seen[v] = true; stack.push(v); } });
      }
      return false;
    },
    /** Camino más corto en número de estaciones (lista de ids) o null. Sirve para el bot de pruebas. */
    shortestPath: function (g, from, to, blocked) {
      var prev = {}, q = [from]; prev[from] = null;
      while (q.length) {
        var u = q.shift();
        if (u === to) { var p = []; for (var n = to; n; n = prev[n]) p.unshift(n); return p; }
        g.adj[u].forEach(function (v) { if (!(v in prev) && !blocked[v]) { prev[v] = u; q.push(v); } });
      }
      return null;
    }
  };
})();
