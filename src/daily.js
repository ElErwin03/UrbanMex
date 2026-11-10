/* UrbanMex · daily — RETO DIARIO (puro, sin motor y SIN INTERNET). Cada día hay una ruta nueva igual para todos los jugadores del mundo:
 * la semilla sale solo de la FECHA del dispositivo (año-mes-día), así que no hace falta conectarse a nada ni a ningún servidor.
 *   · La ruta, los bloqueos, los eventos y hasta los "dados" (asaltos, noticias) salen de esa semilla: misma fecha = mismo reto.
 *   · La dificultad sube durante la semana (lunes fácil, domingo experto) y se genera con el mismo generador del modo infinito.
 *   · Se guarda en el dispositivo: el resultado de cada día (últimos 60), la racha de días seguidos y la mejor racha.
 * Si cambias la hora del dispositivo, el reto cambia con ella (no hay forma de impedirlo sin internet); la racha nunca sube por un día anterior al último jugado. */
(function () {
  var U = gdjs.UrbanMex, util = U.util;
  if (U.Daily) return;

  var EPOCH = Date.UTC(2026, 0, 1);                                   // el reto #1 es el 1 de enero de 2026
  var ROUNDS = [9, 2, 3, 4, 5, 6, 7];                                 // dificultad (ronda del generador infinito) según el día: domingo, lunes ... sábado
  var LEVELS = [['EXPERTO', 4], ['FACIL', 1], ['FACIL', 1], ['MEDIO', 2], ['MEDIO', 2], ['DIFICIL', 3], ['DIFICIL', 3]];
  var WEEKDAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  var KEEP_DAYS = 60, DAY_MS = 86400000, KEY_RE = /^(\d{4})-(\d\d)-(\d\d)$/;
  var cache = {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** 'AAAA-MM-DD' con la fecha LOCAL del dispositivo. */
  function key(d) { d = d || Daily.now(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(k) { var m = KEY_RE.exec(k || ''); if (!m) return null; var y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y: y, m: mo, d: d, t: t.getTime() } : null; }
  function fromTime(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function newLog() { return { last: null, streak: 0, best: 0, wins: 0, played: 0, days: {} }; }
  function log() { return U.session.dailyLog || (U.session.dailyLog = newLog()); }

  var Daily = {
    WEEKDAYS: WEEKDAYS, KEEP_DAYS: KEEP_DAYS, now: function () { return new Date(); },
    key: key, parse: parse, newLog: newLog,
    prevKey: function (k) { var p = parse(k); return p ? fromTime(p.t - DAY_MS) : null; },
    /** Número del reto (#1 = 1 de enero de 2026). */
    number: function (k) { var p = parse(k); return p ? Math.max(1, Math.floor((p.t - EPOCH) / DAY_MS) + 1) : 1; },
    weekday: function (k) { var p = parse(k); return p ? new Date(p.t).getUTCDay() : 1; },
    weekdayName: function (k) { return WEEKDAYS[Daily.weekday(k)]; },
    /** Ronda del generador que da la dificultad de ese día. */
    round: function (k) { return ROUNDS[Daily.weekday(k)]; },
    /** { label: 'FACIL'|'MEDIO'|'DIFICIL'|'EXPERTO', pips: 1-4 }. */
    difficulty: function (k) { var l = LEVELS[Daily.weekday(k)]; return { label: l[0], pips: l[1] }; },
    /** Semilla del día: solo depende de la fecha. */
    seed: function (k) { var p = parse(k); return p ? p.y * 10000 + p.m * 100 + p.d : 1; },
    /** Los "dados" del día (asaltos, noticias): mismos números para todos. */
    rnd: function (k) { return util.seeded(Daily.seed(k) * 31 + 7); },
    /** El nivel del día (siempre el mismo para esa fecha y siempre ganable). Se calcula una vez y se recuerda. */
    level: function (data, k) {
      var hit = cache[k]; if (hit && hit.data === data) return hit.lv;
      var lv = Object.assign({}, U.Infinite.level(data, Daily.seed(k), Daily.round(k)));
      lv.daily = k; lv.id = Daily.number(k); lv.day = 'RETO #' + lv.id;
      lv.startDesc = 'Sales de ' + U.Infinite.nice(lv.start) + '. Es el reto de hoy: la misma ruta para todos.'; lv.goalDesc = 'Llegaste a ' + U.Infinite.nice(lv.goal) + '!';
      cache[k] = { data: data, lv: lv }; return lv;
    },

    /** Empieza el reto de la fecha `k` (por defecto hoy). */
    start: function (k) { U.session.infinite = null; U.session.dailyRun = { key: k || key() }; return U.session.dailyRun; },
    /** Sale del reto (para jugar un nivel normal o el modo infinito). */
    clear: function () { U.session.dailyRun = null; },
    /** Se desbloquea al completar el primer nivel (para que ya conozcas las reglas). */
    unlocked: function () { return U.session.completed.length >= 1; },

    /** Racha de días seguidos que sigue viva a la fecha `k`: cuenta si el último día ganado fue hoy o ayer. */
    streak: function (k) { var l = log(); return l.last && (l.last === k || l.last === Daily.prevKey(k)) ? l.streak : 0; },
    /** Resultado guardado de ese día (o null). */
    day: function (k) { return log().days[k] || null; },
    /** Estado para el menú: { key, number, weekday, difficulty, done, stars, tries, streak, best, wins }. */
    status: function (k) {
      k = k || key(); var l = log(), d = l.days[k];
      return { key: k, number: Daily.number(k), weekday: Daily.weekdayName(k), difficulty: Daily.difficulty(k), done: !!(d && d.won), stars: d ? d.stars : 0, tries: d ? d.tries : 0,
               streak: Daily.streak(k), best: l.best, wins: l.wins, played: l.played };
    },
    /** Los últimos `n` días hasta `k` (el más viejo primero): [{ key, state: 'won'|'lost'|'none'|'today' }]. */
    week: function (k, n) {
      var out = [], l = log(), cur = parse(k); if (!cur) return out;
      for (var i = (n || 7) - 1; i >= 0; i--) {
        var kk = fromTime(cur.t - i * DAY_MS), d = l.days[kk];
        out.push({ key: kk, state: d && d.won ? 'won' : d ? 'lost' : i === 0 ? 'today' : 'none' });
      }
      return out;
    },
    /** Minutos que faltan para el próximo reto (medianoche del dispositivo). */
    minutesLeft: function (d) { d = d || Daily.now(); return 24 * 60 - (d.getHours() * 60 + d.getMinutes()); },

    /** Fin de una partida del reto (se llama una vez). → { key, number, first (primera victoria del día), streak, best, newBest (mejor marca del día), entry }. */
    finish: function (run, stars) {
      var k = run.level.daily, l = log(); if (!k) return null;
      var d = l.days[k] || (l.days[k] = { tries: 0, won: false, stars: 0, money: 0, minute: 0 }), first = false, better = false;
      d.tries++; l.played++;
      if (run.won) {
        first = !d.won; if (first) { l.wins++; d.won = true; }
        var m = Math.round(run.money), improved = first || stars > d.stars || (stars === d.stars && m > d.money);          // la mejor marca del día: más estrellas y, a igualdad, más dinero
        if (improved) { better = !first; d.stars = stars; d.money = m; d.minute = Math.round(run.minute); }
        if (first && (!l.last || k > l.last)) { l.streak = l.last && l.last === Daily.prevKey(k) ? l.streak + 1 : 1; l.last = k; if (l.streak > l.best) l.best = l.streak; }
      }
      var ks = Object.keys(l.days).sort(); while (ks.length > KEEP_DAYS) delete l.days[ks.shift()];
      U.Save.persist();
      return { key: k, number: Daily.number(k), first: first, streak: Daily.streak(k), best: l.best, better: better, entry: { tries: d.tries, stars: d.stars, money: d.money } };
    }
  };
  U.Daily = Daily;
})();
