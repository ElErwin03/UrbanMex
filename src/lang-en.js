/* UrbanMex · lang-en — inglés: menús, accesibilidad, sonido, logros, créditos, celular y nivel (ver i18n.js). Noticias, niveles y eventos: lang-en-data.js; tutorial y resultado: lang-en-play.js. */
(function () {
  var U = gdjs.UrbanMex;
  if (!U.I18n) return;
  U.I18n.keep(['Fabian Enrique', 'Real Ramirez', 'Edwin Alberto', 'Barrera Franco', 'René Domínguez', 'Oscar', 'URBAN', 'MEX', 'v', 'X', 'B', 'P', 'PELIGRO!', 'LTE', 'GDevelop']);
  U.I18n.add('en', {
    // ---- menú principal
    '"Llegar a la meta... si el Metro lo permite"': '"Reach the goal... if the Metro allows it"',
    '{0}/{1} niveles completados': '{0}/{1} levels completed',
    'JUGAR': 'PLAY', 'SELECCIONAR NIVEL': 'SELECT LEVEL', 'MODO INFINITO': 'INFINITE MODE', 'MODO INFINITO - BLOQUEADO': 'INFINITE MODE - LOCKED', 'INFINITO - BLOQUEADO': 'INFINITE - LOCKED', 'INFINITO': 'INFINITE',
    'Completa los {0} niveles para desbloquearlo': 'Complete all {0} levels to unlock it', 'Completa los 10 niveles para desbloquearlo': 'Complete all 10 levels to unlock it',
    'Rutas al azar. Cuantas rondas aguantes?': 'Random routes. How many rounds can you last?', 'Mejor racha: {0} ronda': 'Best streak: {0} round', 'Mejor racha: {0} rondas': 'Best streak: {0} rounds',
    'COMO JUGAR': 'HOW TO PLAY', 'LOGROS {0}/{1}': 'ACHIEVEMENTS {0}/{1}', 'SALIR': 'QUIT', 'SONIDO': 'SOUND', 'ACCESIBILIDAD': 'ACCESSIBILITY', 'CREDITOS': 'CREDITS',
    'NIVEL {0} - {1}': 'LEVEL {0} - {1}', 'NIVEL {0}': 'LEVEL {0}', 'Nivel {0}: {1}': 'Level {0}: {1}', 'NIVEL': 'LEVEL', 'SEMANA {0}': 'WEEK {0}', 'SEMANA 1': 'WEEK 1', 'SEMANA 2': 'WEEK 2',
    '{0} > {1}': '{0} > {1}', '{0}  >  {1}': '{0}  >  {1}', 'RONDA {0}': 'ROUND {0}', 'Ronda {0}': 'Round {0}',
    'SALIR DEL JUEGO': 'QUIT THE GAME', 'Seguro que quieres cerrar el juego?': 'Are you sure you want to close the game?', 'Tu progreso ya esta guardado.': 'Your progress is already saved.', 'SI, SALIR': 'YES, QUIT',
    'GRACIAS POR JUGAR!': 'THANKS FOR PLAYING!', 'Ya puedes cerrar esta ventana.': 'You can close this window now.', 'VOLVER AL MENU': 'BACK TO MENU', 'VOLVER': 'BACK', 'CANCELAR': 'CANCEL',
    'Pulsa JUGAR': 'Press PLAY', 'en el menu': 'in the menu', 'Falta el anterior': 'Needs previous', 'Solo puedes rejugar los niveles que ya completaste.': 'You can only replay levels you have already completed.',
    'Entra con el boton': 'Enter with the', 'JUGAR del menu': 'menu PLAY button', 'Completa el': 'Complete the', 'nivel anterior': 'previous level',
    'SEGURO? TOCA OTRA VEZ': 'SURE? TAP AGAIN', 'BORRAR PROGRESO': 'ERASE PROGRESS',
    '{0}/{1} estrellas': '{0}/{1} stars', '{0} estrellas': '{0} stars', 'ORIGEN': 'START', 'META': 'GOAL', 'SALIDA': 'START', 'Salida': 'Start', 'Meta': 'Goal',
    'VERSION': 'VERSION', 'v{0}  -  hecho con GDevelop': 'v{0}  -  made with GDevelop', 'ESPANOL': 'ESPANOL', 'IDIOMA': 'LANGUAGE',
    // ---- sonido / accesibilidad
    'MUSICA GENERAL': 'MAIN MUSIC', 'Musica relajante de fondo': 'Relaxing background music', 'SONIDOS GENERALES': 'GENERAL SOUNDS', 'Clics, tren, noticias, tienda': 'Clicks, train, news, store',
    'PELIGRO Y APURO': 'DANGER AND RUSH', 'Apuro y golpe de asalto': 'Rush and robbery hit', 'AL SALIR DE LA VENTANA': 'WHEN LEAVING THE WINDOW', 'SONIDO Y MUSICA': 'SOUND AND MUSIC',
    'Sube, baja o silencia cada parte por separado.': 'Turn each part up, down or mute it separately.', 'Ajusta los efectos y los destellos a tu gusto.': 'Adjust the effects and flashes to your liking.',
    'EFECTOS VISUALES': 'VISUAL EFFECTS', 'ALTOS': 'HIGH', 'BAJOS': 'LOW', 'NINGUNO': 'NONE', 'REDUCIR MOVIMIENTO': 'REDUCE MOTION', 'TAMANO DE LA INTERFAZ': 'INTERFACE SIZE', 'AUTO': 'AUTO', 'GRANDE': 'LARGE', 'NORMAL': 'NORMAL',
    'Luces, particulas y sombras. NINGUNO es lo mas ligero. Se aplica al empezar el nivel o el menu.': 'Lights, particles and shadows. NONE is the lightest. Applies when a level or the menu starts.',
    'Luces y sombras. NINGUNO es lo mas ligero.': 'Lights and shadows. NONE is the lightest.',
    'Sin sacudidas, destellos ni parpadeos: los avisos quedan fijos. Se aplica al instante.': 'No shaking, flashes or blinking: alerts stay steady. Applies instantly.', 'Sin sacudidas ni destellos.': 'No shaking or flashes.',
    'AUTO agranda letras y botones en pantallas chicas.': 'AUTO enlarges text and buttons on small screens.', 'AUTO: grande solo en pantallas chicas.': 'AUTO: large only on small screens.',
    'Todo aviso se ve y se oye. El apuro marca con "!" el recurso que se agota, ademas del rojo.': 'Every alert is seen and heard. The rush marks the running-out resource with "!", besides red.',
    'ESC: volver': 'ESC: back', 'ESC o P: continuar': 'ESC or P: resume', 'PAUSA': 'PAUSE', 'PAUSAR': 'PAUSE', 'CONTINUAR': 'RESUME', 'SALIR AL MENU': 'EXIT TO MENU', 'SONIDO Y MUSICA >': 'SOUND AND MUSIC >', 'ACCESIBILIDAD >': 'ACCESSIBILITY >',
    'Seguro que quieres salir del nivel?': 'Are you sure you want to leave the level?', 'Perderas el avance de este dia.': 'You will lose this day\'s progress.',
    'DOBLE CLIC VIAJAR: {0}': 'DOUBLE-CLICK TRAVEL: {0}', 'DOBLE TOQUE: {0}': 'DOUBLE TAP: {0}', 'SI': 'YES',
    'Doble clic en una estacion vecina (la siguiente a la tuya): viajas ahi sin confirmar.': 'Double-click a neighboring station (the next one to yours): you travel there without confirming.',
    'Musica relajante de fondo y un tren lejano que pasa cada minuto, a volumen bajo.': 'Relaxing background music and a distant train passing every minute, at low volume.',
    'El apuro suena cuando te queda menos del 15% del tiempo, dinero o energia.': 'The rush alarm sounds when you have less than 15% of time, money or energy left.',
    // ---- logros (pantalla y catálogo)
    'LOGROS': 'ACHIEVEMENTS', '{0} de {1} desbloqueados': '{0} of {1} unlocked', 'PROGRESO': 'PROGRESS', 'ESTILO DE JUEGO': 'PLAY STYLE', 'EVENTOS DEL DIA': 'DAILY EVENTS',
    'PRIMER VIAJE': 'FIRST TRIP', 'Llega a la meta de un nivel.': 'Reach the goal of a level.', 'Completa los niveles 1 a 5.': 'Complete levels 1 to 5.', 'Completa los niveles 6 a 10.': 'Complete levels 6 to 10.',
    'BRILLANTE': 'SHINING', 'Consigue las 3 estrellas en un nivel.': 'Earn all 3 stars in a level.', 'ESTRELLADO': 'STARRY', 'Junta 15 estrellas en total.': 'Collect 15 stars in total.',
    'CONSTELACION': 'CONSTELLATION', 'Consigue las 30 estrellas de los 10 niveles.': 'Earn all 30 stars of the 10 levels.', 'AHORRADOR': 'SAVER', 'Llega con 100 monedas o más.': 'Arrive with 100 coins or more.',
    'PURO ESFUERZO': 'PURE EFFORT', 'Llega sin comprar ningun Monster (en una ruta de 10 tramos o más).': 'Arrive without buying any Monster (on a route of 10 hops or more).',
    'AL LIMITE': 'AT THE LIMIT', 'Llega a la meta con 10 de stamina o menos.': 'Reach the goal with 10 stamina or less.', 'INTOCABLE': 'UNTOUCHABLE', 'Gana 3 niveles sin que te asalten.': 'Win 3 levels without being robbed.',
    'BIENVENIDO A LA CIUDAD': 'WELCOME TO THE CITY', 'Que te asalten 3 veces en total. Le pasa a todos.': 'Get robbed 3 times in total. It happens to everyone.',
    'ADICTO AL MONSTER': 'MONSTER ADDICT', 'Compra 10 Monster en total.': 'Buy 10 Monsters in total.', 'REY DE LA COMBI': 'COMBI KING', 'Usa la combi 5 veces en total.': 'Use the combi 5 times in total.',
    'METRONAUTA': 'METRONAUT', 'Recorre 200 estaciones en total.': 'Travel through 200 stations in total.', 'BIEN INFORMADO': 'WELL INFORMED', 'Recibe 25 noticias en total.': 'Receive 25 news items in total.',
    'BAJO LA LLUVIA': 'IN THE RAIN', 'Llega a la meta en un nivel con lluvia.': 'Reach the goal in a level with rain.', 'HORA PICO': 'RUSH HOUR', 'Llega a la meta en un nivel con hora pico.': 'Reach the goal in a level with rush hour.',
    'ROMPEHUELGAS': 'STRIKEBREAKER', 'Llega a la meta en un nivel con huelga.': 'Reach the goal in a level with a strike.', 'PACIENCIA': 'PATIENCE', 'Espera a que reabra una línea en huelga y llega a la meta.': 'Wait for a striking line to reopen and reach the goal.',
    'DIA DE TODO': 'EVERYTHING DAY', 'Llega a la meta en un nivel con lluvia, hora pico y huelga a la vez.': 'Reach the goal in a level with rain, rush hour and a strike at once.',
    'SIN FIN': 'ENDLESS', 'Gana tu primera ronda del modo infinito.': 'Win your first round of infinite mode.', 'RACHA DE 5': 'STREAK OF 5', 'Gana 5 rondas seguidas.': 'Win 5 rounds in a row.', 'IMPARABLE': 'UNSTOPPABLE', 'Gana 10 rondas seguidas.': 'Win 10 rounds in a row.',
    'LOGRO DESBLOQUEADO!': 'ACHIEVEMENT UNLOCKED!', 'LOGROS DESBLOQUEADOS!': 'ACHIEVEMENTS UNLOCKED!', '+ {0} mas en LOGROS': '+ {0} more in ACHIEVEMENTS',
    // ---- créditos
    'EQUIPO': 'TEAM', 'Colaborador': 'Contributor', 'Diseñador': 'Designer', 'Desarrollo del juego': 'Game development', 'REALIZADO EN': 'MADE AT', 'Universidad Autónoma de Nayarit': 'Universidad Autónoma de Nayarit', 'Unidad Académica de Economía': 'Academic Unit of Economics',
    'Proyecto escolar desarrollado en estas instituciones.': 'School project developed at these institutions.', 'Hecho con GDevelop 5. Arte y audio generados con codigo (carpeta tools).': 'Made with GDevelop 5. Art and audio generated with code (tools folder).',
    'Proyecto escolar sin fines de lucro, no afiliado al Metro de la CDMX.': 'Non-profit school project, not affiliated with the CDMX Metro.', 'Universidad': 'University'
  });
})();
