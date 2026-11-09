/* UrbanMex · escena Menú — título, JUGAR (al nivel que toca), selector de niveles ya completados, skyline pixel-art y tren animado. Objetos: Texto, Icono, UIBase, UIModal, Edificio, Tren. */
(function () {
  var U = gdjs.UrbanMex, util = U.util, PAL = U.UI.PAL;
  U.Scenes = U.Scenes || {};
  if (U.Scenes.menu) return;

  function init(scene) {
    var m = scene._um = { t: 0, view: 'main', resetAsk: 0, buildings: [], train: scene.createObject('Tren'), stars: [], fx: U.FX.menu(scene) };
    var rnd = util.seeded(7);
    for (var i = 0; i < 14; i++) {
      var b = scene.createObject('Edificio'); b.setAnimationName('e' + (i % 4)); b.setScale(3);
      b.setPosition(i * 96 - 20, 720 - 96 - rnd() * 60); b.setZOrder(1); m.buildings.push(b);
    }
    m.train.setScale(3); m.train.setZOrder(2); m.train.setPosition(-300, 604);
    for (var s = 0; s < 40; s++) m.stars.push([rnd() * 1280, rnd() * 300, rnd() * 6]);
    return m;
  }

  /** CREDITOS: todo lo que dice la pantalla vive aquí (cambia un nombre o un rol y listo). Los nombres propios llevan su ortografía. */
  U.CREDITS = {
    madeAt: [                                                 // entidades donde (y por qué) se realizó el proyecto
      { name: 'Universidad Autónoma de Nayarit', size: 16 },
      { name: 'Unidad Académica de Economía', size: 12 }
    ],
    why: 'Proyecto escolar desarrollado en estas instituciones.',
    team: [                                                   // quienes lo hicieron
      { first: 'Fabian Enrique', last: 'Real Ramirez', role: 'Desarrollo del juego' },     // nombre y apellidos van en dos líneas para que quepan en la tarjeta
      { first: 'Edwin Alberto', last: 'Barrera Franco', role: 'Diseñador' },
      { first: 'Oscar', last: 'René Domínguez', role: 'Colaborador' }
    ],
    madeWith: ['Hecho con GDevelop 5. Arte y audio generados con codigo (carpeta tools).', 'Proyecto escolar sin fines de lucro, no afiliado al Metro de la CDMX.']
  };

  var go = function (scene, name) { scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, name); };

  /** Pantalla principal: JUGAR siempre lleva al primer nivel sin completar y dice cuál es (como en Plants vs. Zombies). */
  function drawMain(scene, ui, m, data) {
    var total = data ? data.levels.length : 5, next = U.Save.nextLevel(total), lv = data && data.levels[next];
    var done = U.session.completed.filter(function (i) { return i < total; }).length;
    ui.icon('logo', 'meta', 592, 70, 6, { z: 220 });
    ui.text('t1', 'URBAN', 640, 190, { size: 24, align: 'center', color: PAL.orange });
    ui.text('t2', 'MEX', 640, 230, { size: 24, align: 'center', color: PAL.orange });
    ui.text('t3', '"Llegar a la meta... si el Metro lo permite"', 640, 280, { size: 8, align: 'center', color: PAL.dim });
    for (var i = 0; i < total; i++) {           // un cuadrito por nivel: verde si ya lo completaste
      var ok = U.Save.isCompleted(i);
      ui.rect(640 - (total * 30 - 10) / 2 + i * 30, 312, 20, 20, { fill: ok ? '46;204;113' : i === next ? '255;200;60' : '40;40;70', border: '255;255;255', bw: 2 });
    }
    var stars = U.Save.totalStars(total);
    ui.text('prog', done + '/' + total + ' niveles completados' + (stars ? '  -  ' + stars + '/' + total * 3 + ' estrellas' : ''), 640, 342, { size: 8, align: 'center', color: PAL.dim });
    var seen = U.session.seenTutorial;
    if (ui.button('play', '', 440, 364, 400, 84, { size: 8 }) && lv) {
      U.session.infinite = null; U.session.levelIndex = next; U.session.afterTutorial = 'Nivel'; go(scene, seen ? 'Nivel' : 'Tutorial');
    }
    ui.text('pl1', 'JUGAR', 640, 374, { size: 24, align: 'center' });
    ui.text('pl2', lv ? 'NIVEL ' + lv.id + ' - ' + lv.day : 'Cargando...', 640, 408, { size: 12, align: 'center', color: '255;235;180' });
    if (lv) ui.text('pl3', lv.start + ' > ' + lv.goal, 640, 430, { size: 8, align: 'center', color: '255;220;190' });
    var M = ui.mob;                                                                                  // modo celular: botones de 44 px
    if (ui.button('sel', 'SELECCIONAR NIVEL', 490, M ? 456 : 462, 300, 44, { size: 8, fill: '70;70;100' })) m.view = 'levels';
    var open = U.Infinite.unlocked(total), ib = U.session.inf || { best: 0, stars: 0 };           // MODO INFINITO: se desbloquea al completar todos los niveles
    if (ui.button('inf', open ? 'MODO INFINITO' : (M ? 'INFINITO - BLOQUEADO' : 'MODO INFINITO - BLOQUEADO'), 490, M ? 506 : 514, 300, 44, { size: 8, fill: open ? '120;60;160' : '50;50;70', disabled: !open })) { U.Infinite.start(); U.session.afterTutorial = 'Nivel'; go(scene, 'Nivel'); }
    ui.text('infh', open ? (ib.best ? 'Mejor racha: ' + ib.best + (ib.best === 1 ? ' ronda' : ' rondas') + ' - ' + ib.stars + ' estrellas' : 'Rutas al azar. Cuantas rondas aguantes?') : 'Completa los ' + total + ' niveles para desbloquearlo', 640, M ? 556 : 566, { size: 8, align: 'center', color: open ? '210;170;240' : '110;110;140' });
    if (ui.button('how', 'COMO JUGAR', 490, M ? 578 : 584, 146, M ? 44 : 36, { size: 8, fill: '70;70;100' })) { U.session.afterTutorial = 'Menu'; go(scene, 'Tutorial'); }
    var ac = U.Achievements.count();                                                                // LOGROS: pantalla con todos y cuántos llevas
    if (ui.button('ach', 'LOGROS ' + ac.got + '/' + ac.total, 644, M ? 578 : 584, 146, M ? 44 : 36, { size: 8, fill: '150;110;20' })) m.view = 'ach';
    if (ui.button('quit', 'SALIR', 490, M ? 630 : 630, 300, M ? 44 : 36, { size: 8, fill: '110;50;50' })) m.confirmExit = true;      // pide confirmación antes de cerrar
  }

  /** Ventana "¿Seguro que quieres salir?". SI cierra el juego (ventana de GDevelop / app); en un navegador no se puede cerrar la pestaña, así que
   *  se muestra una despedida con la opción de volver. El progreso ya se guarda solo, pero se guarda otra vez al salir. */
  function drawConfirmExit(scene, ui, m) {
    ui.rect(0, 0, 1280, 720, { fill: '0;0;0', alpha: 170, bw: 0, modal: true, block: true });
    var w = 560, h = 250, x = 360, y = 200;
    ui.rect(x, y, w, h, { fill: '16;14;32', border: PAL.orange, bw: 4, modal: true, block: true });
    ui.text('cx:t', 'SALIR DEL JUEGO', x + w / 2, y + 24, { size: 16, align: 'center', color: PAL.orange, z: 320 });
    ui.text('cx:1', 'Seguro que quieres cerrar el juego?', x + w / 2, y + 86, { size: 8, align: 'center', color: '230;234;250', z: 320 });
    ui.text('cx:2', 'Tu progreso ya esta guardado.', x + w / 2, y + 112, { size: 8, align: 'center', color: PAL.dim, z: 320 });
    if (ui.button('cx:no', 'CANCELAR', x + 40, y + h - 70, 220, 44, { size: 8, fill: '70;70;100', modal: true })) m.confirmExit = false;
    if (ui.button('cx:si', 'SI, SALIR', x + w - 260, y + h - 70, 220, 44, { size: 8, fill: '192;57;43', modal: true })) {
      m.confirmExit = false; m.view = 'bye'; U.Save.persist();
      scene.requestChange(gdjs.SceneChangeRequest.STOP_GAME);              // cierra la ventana / app (Electron, Cordova, vista previa)
      try { if (typeof window !== 'undefined' && window.close) window.close(); } catch (e) { /* un navegador puede negarse: queda la despedida */ }
    }
  }

  /** Despedida (solo se ve si el entorno no pudo cerrar la ventana, p. ej. una pestaña de navegador). */
  function drawBye(scene, ui, m) {
    ui.text('by1', 'GRACIAS POR JUGAR!', 640, 250, { size: 24, align: 'center', color: PAL.yellow });
    ui.text('by2', 'Ya puedes cerrar esta ventana.', 640, 320, { size: 12, align: 'center', color: '230;234;250' });
    if (ui.button('byb', 'VOLVER AL MENU', 490, 400, 300, 48, { size: 8, fill: '70;70;100' })) m.view = 'main';
  }

  /** Tarjeta de nivel en modo celular: letras de 12 px (los nombres de estación se parten en 2 líneas) y botón REJUGAR de 44 px. */
  function drawLevelCardMobile(scene, ui, lv, i, ok, cur, col, row, x, y, W, H) {
    var live = ok || cur, nameC = live ? '230;234;250' : '90;90;120', cols = Math.floor((W - 28) / ui.fs(8));
    if (col === 0) ui.text('wk' + row, 'SEMANA ' + (row + 1), x, y - 20, { size: 8, color: PAL.orange });
    ui.rect(x, y, W, H, { fill: ok ? '22;48;38' : cur ? '48;42;20' : '20;20;38', border: ok ? '46;204;113' : cur ? '255;200;60' : '60;60;90', bw: 3 });
    ui.text('n' + i, String(lv.id), x + W / 2, y + 10, { size: 16, align: 'center', color: ok ? PAL.green : cur ? PAL.yellow : '90;90;120' });
    ui.text('d' + i, lv.day, x + W / 2, y + 36, { size: 12, align: 'center', color: live ? '255;255;255' : '110;110;140' });
    ui.text('sl' + i, 'SALIDA', x + 14, y + 62, { size: 8, color: PAL.dim });
    ui.lines('s' + i, util.wrap(lv.start, cols).slice(0, 2), x + 14, y + 78, { size: 8, lineH: 12, color: nameC });
    ui.text('ml' + i, 'META', x + 14, y + 118, { size: 8, color: PAL.dim });
    ui.lines('g' + i, util.wrap(lv.goal, cols).slice(0, 2), x + 14, y + 134, { size: 8, lineH: 12, color: nameC });
    if (ok) {
      var bs = U.Save.bestOf(i);
      if (bs) for (var k = 0; k < 3; k++) ui.icon('ck' + i + ':' + k, k < bs.stars ? 'estrella' : 'estrella_vacia', x + W / 2 - 60 + k * 40, y + 174, 2);
      else ui.icon('ck' + i, 'meta', x + W / 2 - 16, y + 176, 2);
      if (ui.button('re' + i, 'REJUGAR', x + 14, y + H - 56, W - 28, 44, { size: 8, fill: '39;174;96' })) { U.session.infinite = null; U.session.levelIndex = i; U.session.afterTutorial = 'Nivel'; go(scene, 'Nivel'); }
    } else if (cur) {
      ui.text('st' + i, 'SIGUIENTE', x + W / 2, y + 180, { size: 12, align: 'center', color: PAL.yellow });
      ui.lines('sg' + i, ['Pulsa JUGAR', 'en el menu'], x + W / 2, y + 214, { size: 8, lineH: 14, align: 'center', color: '230;214;160' });
    } else {
      ui.icon('lk' + i, 'bloqueo', x + W / 2 - 16, y + 170, 2, { opacity: 120 });
      ui.text('st' + i, 'BLOQUEADO', x + W / 2, y + 212, { size: 8, align: 'center', color: '110;110;140' });
      ui.text('sg' + i, 'Falta el anterior', x + W / 2, y + 236, { size: 8, align: 'center', color: '90;90;120' });
    }
  }

  /** Selector: solo se pueden rejugar los niveles ya completados; el siguiente se juega con JUGAR. Cinco niveles por fila (una semana por fila). */
  var CARD = { w: 220, h: 236, gap: 16, perRow: 5, y0: 142, rowGap: 38 }, CARD_M = { w: 220, h: 266, gap: 16, perRow: 5, y0: 84, rowGap: 30 };   // _M: modo celular
  function drawLevels(scene, ui, m, data) {
    var M = ui.mob, C = M ? CARD_M : CARD;
    ui.text('h', 'SELECCIONAR NIVEL', 640, M ? 16 : 44, { size: 24, align: 'center', color: PAL.yellow });
    if (!M) ui.text('hs', 'Solo puedes rejugar los niveles que ya completaste.', 640, 88, { size: 8, align: 'center', color: PAL.dim });
    var total = data ? data.levels.length : 0, next = U.Save.nextLevel(total), W = C.w, G = C.gap, x0 = (1280 - (C.perRow * W + (C.perRow - 1) * G)) / 2;
    data && data.levels.forEach(function (lv, i) {
      var ok = U.Save.isCompleted(i), cur = !ok && i === next, col = i % C.perRow, row = Math.floor(i / C.perRow), x = x0 + col * (W + G), y = C.y0 + row * (C.h + C.rowGap);
      if (M) return drawLevelCardMobile(scene, ui, lv, i, ok, cur, col, row, x, y, W, C.h);
      if (col === 0) ui.text('wk' + row, 'SEMANA ' + (row + 1), x, y - 20, { size: 8, color: PAL.orange });
      ui.rect(x, y, W, C.h, { fill: ok ? '22;48;38' : cur ? '48;42;20' : '20;20;38', border: ok ? '46;204;113' : cur ? '255;200;60' : '60;60;90', bw: 3 });
      ui.text('n' + i, String(lv.id), x + W / 2, y + 10, { size: 16, align: 'center', color: ok ? PAL.green : cur ? PAL.yellow : '90;90;120' });
      ui.text('d' + i, lv.day, x + W / 2, y + 36, { size: 12, align: 'center', color: ok || cur ? '255;255;255' : '110;110;140' });
      ui.text('sl' + i, 'SALIDA', x + 14, y + 62, { size: 8, color: PAL.dim });
      ui.lines('s' + i, util.wrap(lv.start, 24), x + 14, y + 76, { size: 8, lineH: 12, color: ok || cur ? '230;234;250' : '90;90;120' });
      ui.text('ml' + i, 'META', x + 14, y + 108, { size: 8, color: PAL.dim });
      ui.lines('g' + i, util.wrap(lv.goal, 24), x + 14, y + 122, { size: 8, lineH: 12, color: ok || cur ? '230;234;250' : '90;90;120' });
      if (ok) {
        var bs = U.Save.bestOf(i);                                                                   // mejor marca: tres estrellas (si el guardado es anterior a las estrellas, la meta de siempre)
        if (bs) for (var k = 0; k < 3; k++) ui.icon('ck' + i + ':' + k, k < bs.stars ? 'estrella' : 'estrella_vacia', x + W / 2 - 60 + k * 40, y + 152, 2);
        else ui.icon('ck' + i, 'meta', x + W / 2 - 16, y + 154, 2);
        if (ui.button('re' + i, 'REJUGAR', x + 14, y + 192, W - 28, 34, { size: 8, fill: '39;174;96' })) { U.session.infinite = null; U.session.levelIndex = i; U.session.afterTutorial = 'Nivel'; go(scene, 'Nivel'); }
      } else if (cur) {
        ui.text('st' + i, 'SIGUIENTE', x + W / 2, y + 160, { size: 12, align: 'center', color: PAL.yellow });
        ui.lines('sg' + i, ['Entra con el boton', 'JUGAR del menu'], x + W / 2, y + 190, { size: 8, lineH: 14, align: 'center', color: '230;214;160' });
      } else {
        ui.icon('lk' + i, 'bloqueo', x + W / 2 - 16, y + 152, 2, { opacity: 120 });
        ui.text('st' + i, 'BLOQUEADO', x + W / 2, y + 192, { size: 8, align: 'center', color: '110;110;140' });
        ui.lines('sg' + i, ['Completa el', 'nivel anterior'], x + W / 2, y + 204, { size: 8, lineH: 14, align: 'center', color: '90;90;120' });
      }
    });
    if (ui.button('back', 'VOLVER', 490, M ? 654 : 662, 300, 44, { size: 8, fill: '70;70;100' })) m.view = 'main';
    var ask = m.resetAsk > m.t;                                            // borrar el progreso pide confirmación (segundo toque en 3 s)
    if (ui.button('wipe', ask ? 'SEGURO? TOCA OTRA VEZ' : 'BORRAR PROGRESO', M ? 940 : 960, M ? 654 : 658, M ? 320 : 290, M ? 44 : 36, { size: 8, fill: ask ? '200;60;50' : '110;50;50' })) {
      if (ask) { U.Save.reset(); m.resetAsk = 0; } else m.resetAsk = m.t + 3;
    }
  }

  /** LOGROS: todos en una cuadrícula; los conseguidos brillan y los pendientes dicen qué hacer (con su avance si cuentan algo). */
  var ACH = { w: 300, h: 78, gap: 12, cols: 4, y0: 104, step: 84 }, GROUP_COLOR = { progreso: '46;204;113', estilo: '90;170;255', eventos: '243;156;18', infinito: '190;110;230' };
  function drawAchievements(scene, ui, m) {
    if (ui.mob) return drawAchievementsMobile(scene, ui, m);
    var A = U.Achievements, c = A.count(), x0 = (1280 - (ACH.cols * ACH.w + (ACH.cols - 1) * ACH.gap)) / 2;
    ui.text('ah', 'LOGROS', 640, 28, { size: 24, align: 'center', color: PAL.yellow });
    ui.text('ac', c.got + ' de ' + c.total + ' desbloqueados', 640, 70, { size: 8, align: 'center', color: PAL.dim });
    ui.rect(440, 84, 400, 8, { fill: '24;24;46', border: '60;60;90', bw: 2 }); if (c.got) ui.rect(442, 86, Math.max(4, 396 * c.got / c.total), 4, { fill: '255;200;60', bw: 0 });
    A.LIST.forEach(function (a, i) {
      var x = x0 + (i % ACH.cols) * (ACH.w + ACH.gap), y = ACH.y0 + Math.floor(i / ACH.cols) * ACH.step, on = A.has(a.id), pr = A.progress(a);
      ui.rect(x, y, ACH.w, ACH.h, { fill: on ? '44;38;14' : '20;20;38', border: on ? '255;200;60' : '60;60;90', bw: on ? 3 : 2 });
      ui.rect(x + 3, y + 3, 5, ACH.h - 6, { fill: on ? GROUP_COLOR[a.group] : '50;50;70', bw: 0 });
      ui.icon('ai' + i, on ? 'trofeo' : 'bloqueo', x + 16, y + 12, 2, on ? {} : { opacity: 110 });
      ui.text('an' + i, a.name, x + 60, y + 10, { size: 8, color: on ? '255;230;120' : '150;150;180' });
      ui.lines('ad' + i, util.wrap(a.desc, 27), x + 60, y + 28, { size: 8, lineH: 12, color: on ? '230;234;250' : '110;110;140' });
      if (pr && !on) ui.text('ap' + i, pr[0] + '/' + pr[1], x + ACH.w - 10, y + ACH.h - 16, { size: 8, align: 'right', color: PAL.orange });
    });
    if (ui.button('aback', 'VOLVER', 490, 618, 300, 40, { size: 8, fill: '70;70;100' })) m.view = 'main';
  }

  /** LOGROS en modo celular: 9 por página (3 x 3) con letras de 12 px y botones < / > de 44 px. */
  var ACH_M = { w: 404, h: 112, gap: 12, cols: 3, rows: 3, y0: 100 };
  function drawAchievementsMobile(scene, ui, m) {
    var A = U.Achievements, c = A.count(), per = ACH_M.cols * ACH_M.rows, pages = Math.ceil(A.LIST.length / per), x0 = (1280 - (ACH_M.cols * ACH_M.w + (ACH_M.cols - 1) * ACH_M.gap)) / 2;
    m.achPage = util.clamp(m.achPage || 0, 0, pages - 1);
    ui.text('ah', 'LOGROS', 640, 14, { size: 24, align: 'center', color: PAL.yellow });
    ui.text('ac', c.got + ' de ' + c.total + ' desbloqueados', 640, 52, { size: 8, align: 'center', color: PAL.dim });
    ui.rect(440, 74, 400, 8, { fill: '24;24;46', border: '60;60;90', bw: 2 }); if (c.got) ui.rect(442, 76, Math.max(4, 396 * c.got / c.total), 4, { fill: '255;200;60', bw: 0 });
    A.LIST.slice(m.achPage * per, (m.achPage + 1) * per).forEach(function (a, k) {
      var i = m.achPage * per + k, x = x0 + (k % ACH_M.cols) * (ACH_M.w + ACH_M.gap), y = ACH_M.y0 + Math.floor(k / ACH_M.cols) * (ACH_M.h + ACH_M.gap), on = A.has(a.id), pr = A.progress(a);
      ui.rect(x, y, ACH_M.w, ACH_M.h, { fill: on ? '44;38;14' : '20;20;38', border: on ? '255;200;60' : '60;60;90', bw: on ? 3 : 2 });
      ui.rect(x + 3, y + 3, 5, ACH_M.h - 6, { fill: on ? GROUP_COLOR[a.group] : '50;50;70', bw: 0 });
      ui.icon('ai' + i, on ? 'trofeo' : 'bloqueo', x + 16, y + 12, 2, on ? {} : { opacity: 110 });
      ui.text('an' + i, a.name, x + 60, y + 12, { size: 8, color: on ? '255;230;120' : '150;150;180' });
      ui.lines('ad' + i, util.wrap(a.desc, Math.floor((ACH_M.w - 72) / ui.fs(8))), x + 60, y + 34, { size: 8, lineH: 12, color: on ? '230;234;250' : '110;110;140' });
      if (pr && !on) ui.text('ap' + i, pr[0] + '/' + pr[1], x + ACH_M.w - 12, y + 12, { size: 8, align: 'right', color: PAL.orange });
    });
    var ny = ACH_M.y0 + ACH_M.rows * (ACH_M.h + ACH_M.gap) + 4;
    if (ui.button('apg-', '<', 440, ny, 80, 44, { size: 16, fill: '60;60;90', disabled: m.achPage <= 0 })) m.achPage--;
    ui.text('apg', (m.achPage + 1) + '/' + pages, 640, ny + 16, { size: 8, align: 'center', color: PAL.dim });
    if (ui.button('apg+', '>', 760, ny, 80, 44, { size: 16, fill: '60;60;90', disabled: m.achPage >= pages - 1 })) m.achPage++;
    if (ui.button('aback', 'VOLVER', 490, ny + 58, 300, 44, { size: 8, fill: '70;70;100' })) m.view = 'main';
  }

  /** Créditos: las entidades donde se realizó, el equipo y con qué se hizo. */
  function drawCredits(scene, ui, m) {
    var C = U.CREDITS;
    ui.text('cr:h', 'CREDITOS', 640, 40, { size: 24, align: 'center', color: PAL.yellow });
    ui.rect(190, 104, 900, 190, { fill: '24;24;46', border: '60;60;90', bw: 2 });
    ui.text('cr:a', 'REALIZADO EN', 640, 122, { size: 8, align: 'center', color: PAL.dim });
    var y = 152; C.madeAt.forEach(function (e, i) { ui.text('cr:e' + i, e.name, 640, y, { size: e.size, align: 'center', color: i ? '255;235;180' : PAL.orange }); y += e.size + 22; });
    ui.text('cr:w', C.why, 640, 250, { size: 8, align: 'center', color: '230;234;250' });
    ui.text('cr:t', 'EQUIPO', 640, 322, { size: 8, align: 'center', color: PAL.dim });
    var n = C.team.length, cw = 270, gap = 24, x0 = 640 - (n * cw + (n - 1) * gap) / 2;
    C.team.forEach(function (p, i) {
      var x = x0 + i * (cw + gap);
      ui.rect(x, 346, cw, 110, { fill: '24;24;46', border: i ? '60;60;90' : PAL.orange, bw: 2 });
      ui.text('cr:n' + i, p.first, x + cw / 2, 368, { size: 16, align: 'center' });
      ui.text('cr:l' + i, p.last, x + cw / 2, 392, { size: 16, align: 'center' });
      ui.text('cr:r' + i, p.role, x + cw / 2, 428, { size: 8, align: 'center', color: PAL.dim });
    });
    C.madeWith.forEach(function (l, i) { ui.text('cr:m' + i, l, 640, 492 + i * 24, { size: 8, align: 'center', color: i ? '120;120;150' : '230;234;250' }); });
    if (ui.button('cback', 'VOLVER', 490, 574, 300, 48, { size: 8, fill: '70;70;100' })) m.view = 'main';
  }

  /** Volumen y silencio de la música general, los sonidos generales y el sonido de peligro y apuro (se guardan). */
  function drawSound(scene, ui, m) {
    var M = ui.mob, oy = M ? -50 : 0;                                                              // modo celular: filas más altas (botones de 44 px), todo sube
    ui.text('h', 'SONIDO', 640, M ? 24 : 70, { size: 24, align: 'center', color: PAL.yellow });
    ui.text('hs', 'Sube, baja o silencia cada parte por separado.', 640, M ? 68 : 116, { size: 8, align: 'center', color: PAL.dim });
    ui.rect(300, M ? 100 : 150, 680, M ? 420 : 330, { fill: '24;24;46', border: '60;60;90', bw: 2 });
    var sh = U.Audio.panel(ui, scene, 'mn:', 330, 172 + oy + (M ? -2 : 0), 620, true);
    U.Audio.focusRow(ui, scene, 'mn:', 330, 172 + oy + sh + 4, 620);
    if (M) ui.lines('hn', util.wrap('El apuro suena cuando te queda menos del 15% del tiempo, dinero o energia.', 50), 330, 172 + oy + sh + 66, { size: 8, lineH: 12, color: PAL.dim });
    else ui.text('hn', 'El apuro suena cuando te queda menos del 15% del tiempo, dinero o energia.', 640, 500, { size: 8, align: 'center', color: PAL.dim });
    if (ui.button('sback', 'VOLVER', 490, M ? 590 : 536, 300, 48, { size: 8, fill: '70;70;100' })) m.view = 'main';
  }

  /** Accesibilidad: efectos visuales y reducir movimiento (se guardan). */
  function drawA11y(scene, ui, m) {
    ui.text('h', 'ACCESIBILIDAD', 640, 70, { size: 24, align: 'center', color: PAL.yellow });
    ui.text('hs', 'Ajusta los efectos y los destellos a tu gusto.', 640, 116, { size: 8, align: 'center', color: PAL.dim });
    var ph = U.A11y.height(620, ui.mob);
    ui.rect(300, 150, 680, ph + 44, { fill: '24;24;46', border: '60;60;90', bw: 2 });
    U.A11y.panel(ui, scene, 'ma:', 330, 172, 620);
    if (ui.button('aback', 'VOLVER', 490, 150 + ph + 44 + 24, 300, 48, { size: 8, fill: '70;70;100' })) m.view = 'main';
  }

  U.Scenes.menu = function (scene) {
    var ui = U.UI.of(scene), m = scene._um || init(scene), dt = Math.min(0.1, scene.getElapsedTime() / 1000), data = U.Data.ready(scene);
    U.Save.load(); if (!U.session.swept) { U.session.swept = true; U.Achievements.sweep(); }   // logros de progreso que ya se cumplían antes de existir
    m.t += dt; ui.begin();
    var rx = ui.px, ry = ui.py; if (m.confirmExit) { ui.px = -9999; ui.py = -9999; }   // con la ventana de salida abierta, nada de abajo responde al ratón
    m.stars.forEach(function (s) { ui.rect(s[0], s[1], 4, 4, { fill: Math.sin(m.t * 2 + s[2]) > 0 ? '255;255;255' : '120;120;160', bw: 0 }); });
    m.train.setX(((m.t * 220) % 1900) - 300);
    ui.rect(0, 700, 1280, 20, { fill: '10;8;20', border: '10;8;20', bw: 0 });
    if (m.view === 'levels') drawLevels(scene, ui, m, data); else if (m.view === 'sound') drawSound(scene, ui, m); else if (m.view === 'bye') drawBye(scene, ui, m); else if (m.view === 'credits') drawCredits(scene, ui, m); else if (m.view === 'ach') drawAchievements(scene, ui, m); else if (m.view === 'a11y') drawA11y(scene, ui, m); else drawMain(scene, ui, m, data);
    if (m.view !== 'levels') ui.text('ver', 'v' + U.VERSION + '  -  hecho con GDevelop', 640, ui.mob ? 704 : 684, { size: 8, align: 'center', color: '90;90;120' });
    m.fx.update(dt, m);
    U.Audio.tick(scene, 'menu', dt);                                   // música tranquila y tren lejano cada 60 s
    if (m.view === 'main' && ui.button('cred', 'CREDITOS', 1074, 14, 190, ui.mob ? 44 : 30, { size: 8, fill: '70;70;100' })) m.view = 'credits';
    if (m.view === 'main' && ui.button('lang', U.I18n.lang() === 'en' ? 'ESPANOL' : 'ENGLISH', 1074, ui.mob ? 64 : 52, 190, ui.mob ? 44 : 30, { size: 8, fill: '30;90;130' })) U.I18n.setLang(U.I18n.lang() === 'en' ? 'es' : 'en');   // IDIOMA: el botón dice a cuál cambia
    if (m.view === 'main' && ui.button('a11y', 'ACCESIBILIDAD', 16, ui.mob ? 64 : 52, 190, ui.mob ? 44 : 30, { size: 8, fill: '70;70;100' })) m.view = 'a11y';
    if (m.view !== 'sound' && m.view !== 'bye' && m.view !== 'credits' && m.view !== 'ach' && m.view !== 'a11y' && ui.button('snd', 'SONIDO', 16, 14, 190, ui.mob ? 44 : 30, { size: 8, fill: '70;70;100' })) m.view = 'sound';   // volumen y silencio de los tres módulos de audio
    ui.px = rx; ui.py = ry; if (m.confirmExit) drawConfirmExit(scene, ui, m);
    ui.end();
  };
})();
