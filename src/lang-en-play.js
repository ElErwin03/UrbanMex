/* UrbanMex · lang-en-play — inglés: reglas (por qué no puedes viajar), eventos del día, noticias del juego y modo infinito (ver i18n.js). */
(function () {
  var U = gdjs.UrbanMex;
  if (!U.I18n) return;
  U.I18n.keep(['peje-coins', 'monedas', 'Monster', 'Monster Energy', 'UNAM', 'MONSTER']);
  U.I18n.add('en', {
    // ---- por qué no puedes viajar (Rules.explain)
    'Te faltan {0} de stamina': 'You are {0} stamina short',
    'La combi gasta {0} de stamina y tienes {1}. Mejor el Metro.': 'The combi uses {0} stamina and you have {1}. Take the Metro instead.', 'La combi gasta {0} de stamina y tienes {1}.': 'The combi uses {0} stamina and you have {1}.',
    'Cuesta {0} y tienes {1}. Compra un Monster en una tienda.': 'It costs {0} and you have {1}. Buy a Monster at a store.',
    'Te faltan {0} {1}': 'You are {0} {1} short',
    'La combi cuesta {0} y tienes {1}. El Metro cuesta {2}.': 'The combi costs {0} and you have {1}. The Metro costs {2}.', 'La combi cuesta {0} y tienes {1}.': 'The combi costs {0} and you have {1}.',
    'Cada estacion cuesta {0} y tienes {1}.': 'Each station costs {0} and you have {1}.',
    'Ya no llegas a tiempo': 'You will not make it in time', 'El viaje dura {0} min y solo quedan {1} min del dia.': 'The trip takes {0} min and only {1} min of the day are left.',
    'Huelga en la linea {0}': 'Strike on line {0}', 'Reabre a las {0}. Busca otra ruta o espera.': 'Reopens at {0}. Find another route or wait.',
    'Estacion bloqueada': 'Station blocked', 'Hay un bloqueo ahi. Busca otra ruta o revisa las noticias.': 'There is a blockade there. Find another route or check the news.',
    'Sin ruta directa': 'No direct route', 'Solo puedes viajar a estaciones conectadas a la actual.': 'You can only travel to stations connected to the current one.', 'Partida terminada': 'Game over',
    'Anocheció y no llegaste a tiempo.': 'Night fell and you did not arrive in time.', 'Te quedaste sin stamina.': 'You ran out of stamina.', 'Te quedaste sin dinero.': 'You ran out of money.', 'Todas las rutas están bloqueadas.': 'All routes are blocked.',
    // ---- eventos del día (events.js)
    'LLUVIA': 'RAIN', 'HUELGA': 'STRIKE', 'HORA PICO': 'RUSH HOUR', 'HUELGA L{0}': 'STRIKE L{0}', 'LLUVIA {0}': 'RAIN {0}',
    'hasta {0}': 'until {0}', 'desde {0}': 'from {0}', 'terminó': 'ended', 'reabrió': 'reopened',
    'DEJO DE LLOVER': 'THE RAIN STOPPED', 'La lluvia paró y el tráfico se va soltando.': 'The rain stopped and traffic is clearing up.', 'Tiempos y esfuerzo normales': 'Normal times and effort',
    'EMPIEZA A LLOVER': 'IT STARTS TO RAIN', 'LLUVIA DESDE LAS {0}': 'RAIN FROM {0}', 'LLUVIA HOY': 'RAIN TODAY', 'Lluvia fuerte en la ciudad: las combis se atascan.': 'Heavy rain in the city: combis get stuck.',
    'Metro +{0} min, combi +{1} min, +{2} stamina por tramo (hasta {3})': 'Metro +{0} min, combi +{1} min, +{2} stamina per hop (until {3})',
    'TERMINO LA HORA PICO': 'RUSH HOUR IS OVER', 'Los trenes ya van más vacíos.': 'Trains are emptier now.', 'Tiempos normales y menos carteristas': 'Normal times and fewer pickpockets',
    'EMPIEZA LA HORA PICO': 'RUSH HOUR STARTS', 'HORA PICO DESDE LAS {0}': 'RUSH HOUR FROM {0}', 'Los trenes van llenos y hay carteristas.': 'Trains are packed and there are pickpockets.',
    'Metro +{0} min por tramo y más riesgo de asalto (hasta {1})': 'Metro +{0} min per hop and higher robbery risk (until {1})',
    'REABRE LA {0}': '{0} REOPENS', 'Terminó el paro de trabajadores.': 'The workers\' strike is over.', 'Ya puedes usarla': 'You can use it now',
    'HUELGA EN LA {0}': 'STRIKE ON {0}', 'Paro de trabajadores: la línea está cerrada.': 'Workers\' strike: the line is closed.', 'Reabre a las {0}. Busca otra ruta': 'Reopens at {0}. Find another route',
    'ESPERAR': 'WAIT', 'ESPERASTE A QUE REABRA': 'YOU WAITED FOR IT TO REOPEN', 'Sin otra salida, esperaste de {0} a {1}.': 'With no other way out, you waited from {0} to {1}.', 'Perdiste {0} min': 'You lost {0} min', 'ESPERASTE {0} MIN': 'YOU WAITED {0} MIN',
    '{0} +{1}min': '{0} +{1}min', '{0} +{1}min +{2}sta': '{0} +{1}min +{2}sta', '{0} +{1}sta': '{0} +{1}sta', '{0} +asalto': '{0} +robbery',
    // ---- mensajes del nivel
    'Ronda {0}': 'Round {0}', 'Nivel {0}: {1}': 'Level {0}: {1}', 'Meta: {0} | Tienes hasta las {1}': 'Goal: {0} | You have until {1}', 'Tip del dia': 'Tip of the day',
    'Revisa las noticias ANTES de viajar. El mapa no te avisa de peligros ni bloqueos.': 'Check the news BEFORE traveling. The map does not warn you about dangers or blockades.', 'Abre la app de Noticias': 'Open the News app',
    // ---- modo infinito
    'RONDA {0}': 'ROUND {0}', 'Sales de {0}. Hoy te toca una ruta nueva.': 'You leave from {0}. Today you get a new route.', 'Llegaste a {0}!': 'You made it to {0}!'
  });
})();
