/* UrbanMex · events — EVENTOS DEL DÍA: condiciones del nivel que cambian las reglas mientras dura su ventana de tiempo (puro, sin motor).
 *
 *   · lluvia   — de `from` a `to`: cada tramo +extraTime min en Metro y +combiExtraTime en combi (la combi se atasca), y +extraStamina de stamina.
 *   · horaPico — de `from` a `to`: el Metro va lleno (+extraTime min por tramo) y hay carteristas (+robberyBonus a la probabilidad de asalto en zonas reportadas).
 *   · huelga   — la línea `line` está cerrada (como un bloqueo) hasta la hora `until`. Si te quedas sin salida por la huelga, esperas solo a que termine.
 *
 * Cada nivel declara los suyos en niveles.json ("events": [{id, from?, to?, line?, until?}]); el efecto y la ventana por defecto están en config.json ("events").
 * El reloj del juego solo avanza al viajar, así que las ventanas se evalúan a la hora en que sales (lluvia, hora pico) o a la hora actual (huelga). */
(function () {
  var U = gdjs.UrbanMex, util = U.util;
  if (U.Events) return;

  var IDS = ['horaPico', 'lluvia', 'huelga'];
  var ICON = { horaPico: 'multitud', lluvia: 'lluvia', huelga: 'bloqueo' };

  /** Eventos del nivel con sus números ya resueltos: { id, label, icon, from, to (huelga: from = inicio del día, to = until), line, cfg }. */
  function list(run) {
    var cfgAll = run.data.config.events || {}, start = run.data.config.dayStartMinute;
    return (run.level.events || []).map(function (e) {
      var c = cfgAll[e.id] || {}, out = { id: e.id, label: c.label || e.id.toUpperCase(), icon: ICON[e.id] || 'noticia', cfg: c, line: e.line ? String(e.line) : null };
      out.from = e.id === 'huelga' ? start : (e.from !== undefined ? e.from : c.from);
      out.to = e.id === 'huelga' ? e.until : (e.to !== undefined ? e.to : c.to);
      return out;
    });
  }
  function on(ev, minute) { return minute >= ev.from && minute < ev.to; }
  function plain(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }   // MAYUSCULAS sin acentos (la letra del juego no dibuja bien las acentuadas en mayúscula)
  function lineName(run, l) { var d = run.data.lines && run.data.lines[l]; return d ? d.name + (d.colorName ? ' (' + d.colorName.toUpperCase() + ')' : '') : 'Línea ' + l; }

  var Events = {
    IDS: IDS, ICON: ICON, list: list,

    /** ¿Está en marcha el evento `id` a esa hora (por defecto, la actual)? */
    active: function (run, id, minute) {
      var m = minute === undefined ? run.minute : minute;
      return list(run).some(function (e) { return e.id === id && on(e, m); });
    },

    /** Huelga que cierra la estación `id` ahora (o null): { id:'huelga', line, until }. */
    strikeAt: function (run, id) {
      var st = run.data.stations[id], m = run.minute, hit = null;
      list(run).forEach(function (e) { if (e.id === 'huelga' && st && st.line === e.line && m < e.to) hit = e; });
      return hit;
    },

    /** Lo que suman los eventos a un tramo que sale ahora: { time, stamina }. */
    hopExtra: function (run, combi) {
      var m = run.minute, out = { time: 0, stamina: 0 };
      list(run).forEach(function (e) {
        if (e.id === 'huelga' || !on(e, m)) return;
        out.time += (combi ? e.cfg.combiExtraTime : e.cfg.extraTime) || 0; out.stamina += e.cfg.extraStamina || 0;
      });
      return out;
    },

    /** Cuánto sube la probabilidad de asalto (a la hora actual). */
    robberyBonus: function (run) {
      var m = run.minute, b = 0;
      list(run).forEach(function (e) { if (e.id !== 'huelga' && on(e, m)) b += e.cfg.robberyBonus || 0; });
      return b;
    },

    /** Estado de cada evento para el HUD: { id, label, icon, state: 'active' | 'soon' | 'over', from, to, line, text }. */
    status: function (run) {
      return list(run).map(function (e) {
        var m = run.minute, state = m >= e.to ? 'over' : m >= e.from ? 'active' : 'soon', c = util.clock;
        var text = e.id === 'huelga' ? (state === 'over' ? 'reabrió' : 'hasta ' + c(e.to)) : state === 'soon' ? 'desde ' + c(e.from) : state === 'active' ? 'hasta ' + c(e.to) : 'terminó';
        return { id: e.id, label: e.id === 'huelga' ? e.label + ' L' + e.line : e.label, icon: e.icon, state: state, from: e.from, to: e.to, line: e.line, text: text };
      });
    },

    /** Textos cortos de los eventos que cambian el costo de un tramo (para el panel de la estación): ['LLUVIA +2 min', 'HORA PICO +4 min']. cost = { event: {time, stamina} } de canTravel. */
    effects: function (run, cost) {
      var m = run.minute, combi = !!(cost && cost.combi), out = [];
      list(run).forEach(function (e) {
        if (e.id === 'huelga' || !on(e, m)) return;
        var t = (combi ? e.cfg.combiExtraTime : e.cfg.extraTime) || 0, st = e.cfg.extraStamina || 0, rb = e.cfg.robberyBonus || 0;
        if (t || st || rb) out.push(e.label + (t ? ' +' + t + 'min' : '') + (st ? ' +' + st + 'sta' : '') + (!t && !st && rb ? ' +asalto' : ''));
      });
      return out;
    },

    /** Cambios de estado al pasar del minuto `prev` al `now`: [{ id, kind: 'start' | 'end', line }] (las que ya estaban en marcha al empezar no cuentan). */
    transitions: function (run, prev, now) {
      var out = [];
      list(run).forEach(function (e) {
        if (e.id !== 'huelga' && e.from > prev && e.from <= now) out.push({ id: e.id, kind: 'start', line: e.line });
        if (e.to > prev && e.to <= now) out.push({ id: e.id, kind: 'end', line: e.line });
      });
      return out;
    },

    /** Texto de una noticia del evento: { title, desc, impact, severity }. kind: 'start' | 'end' | 'now' (al empezar el nivel) | 'soon'. */
    text: function (run, ev, kind) {
      var c = ev.cfg, c10 = util.clock, ln = ev.line ? plain(lineName(run, ev.line)) : '';
      if (ev.id === 'lluvia') {
        if (kind === 'end') return { title: 'DEJO DE LLOVER', desc: 'La lluvia paró y el tráfico se va soltando.', impact: 'Tiempos y esfuerzo normales', severity: 'success' };
        return { title: kind === 'start' ? 'EMPIEZA A LLOVER' : kind === 'soon' ? 'LLUVIA DESDE LAS ' + c10(ev.from) : 'LLUVIA HOY', desc: 'Lluvia fuerte en la ciudad: las combis se atascan.',
                 impact: 'Metro +' + c.extraTime + ' min, combi +' + c.combiExtraTime + ' min, +' + c.extraStamina + ' stamina por tramo (hasta ' + c10(ev.to) + ')', severity: 'warning' };
      }
      if (ev.id === 'horaPico') {
        if (kind === 'end') return { title: 'TERMINO LA HORA PICO', desc: 'Los trenes ya van más vacíos.', impact: 'Tiempos normales y menos carteristas', severity: 'success' };
        return { title: kind === 'start' ? 'EMPIEZA LA HORA PICO' : kind === 'soon' ? 'HORA PICO DESDE LAS ' + c10(ev.from) : 'HORA PICO', desc: 'Los trenes van llenos y hay carteristas.',
                 impact: 'Metro +' + c.extraTime + ' min por tramo y más riesgo de asalto (hasta ' + c10(ev.to) + ')', severity: 'warning' };
      }
      if (kind === 'end') return { title: 'REABRE LA ' + ln.toUpperCase(), desc: 'Terminó el paro de trabajadores.', impact: 'Ya puedes usarla', severity: 'success' };
      return { title: 'HUELGA EN LA ' + ln.toUpperCase(), desc: 'Paro de trabajadores: la línea está cerrada.', impact: 'Reabre a las ' + c10(ev.to) + '. Busca otra ruta', severity: 'danger' };
    },

    /** Cuándo reabre cada línea que sigue en huelga a esta hora: [minuto, ...]. */
    strikeEnds: function (run) {
      var out = []; list(run).forEach(function (e) { if (e.id === 'huelga' && run.minute < e.to) out.push(e.to); });
      return out;
    },

    /** Validación de los datos de un nivel (se usa al cargar): ids conocidos, líneas que existen, ventanas coherentes. */
    validate: function (cfg, lines, lv) {
      (lv.events || []).forEach(function (e) {
        var where = 'Nivel ' + lv.id + ', evento ' + e.id + ': ';
        if (IDS.indexOf(e.id) < 0) throw new Error(where + 'evento desconocido');
        var c = (cfg.events || {})[e.id]; if (!c) throw new Error(where + 'falta config.events.' + e.id);
        if (e.id === 'huelga') {
          if (!lines[String(e.line)]) throw new Error(where + 'línea inexistente: ' + e.line);
          if (!(e.until > cfg.dayStartMinute && e.until <= cfg.dayEndMinute)) throw new Error(where + '"until" fuera del día');
        } else {
          var f = e.from !== undefined ? e.from : c.from, t = e.to !== undefined ? e.to : c.to;
          if (!(f >= cfg.dayStartMinute && t > f && t <= cfg.dayEndMinute)) throw new Error(where + 'ventana inválida');
        }
      });
    }
  };
  U.Events = Events;
})();
