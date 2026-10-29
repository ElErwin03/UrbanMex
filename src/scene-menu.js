/* UrbanMex · escena Menú — título, JUGAR (al nivel que toca), selector de niveles ya completados, skyline pixel-art y tren animado. Objetos: Texto, Icono, UIBase, UIModal, Edificio, Tren. */
(function () {
  var U = gdjs.UrbanMex, util = U.util, PAL = U.UI.PAL;
  U.Scenes = U.Scenes || {};
  if (U.Scenes.menu) return;

  function init(scene) {
    var m = scene._um = { t: 0, view: 'main', resetAsk: 0, buildings: [], train: scene.createObject('Tren'), stars: [] };
    var rnd = util.seeded(7);
    for (var i = 0; i < 14; i++) {
      var b = scene.createObject('Edificio'); b.setAnimationName('e' + (i % 4)); b.setScale(3);
      b.setPosition(i * 96 - 20, 720 - 96 - rnd() * 60); b.setZOrder(1); m.buildings.push(b);
    }
    m.train.setScale(3); m.train.setZOrder(2); m.train.setPosition(-300, 604);
    for (var s = 0; s < 40; s++) m.stars.push([rnd() * 1280, rnd() * 300, rnd() * 6]);
    return m;
  }

  var go = function (scene, name) { scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, name); };

  /** Pantalla principal: JUGAR siempre lleva al primer nivel sin completar y dice cuál es (como en Plants vs. Zombies). */
  function drawMain(scene, ui, m, data) {
    var total = data ? data.levels.length : 5, next = U.Save.nextLevel(total), lv = data && data.levels[next];
    var done = U.session.completed.filter(function (i) { return i < total; }).length;
    ui.icon('logo', 'meta', 592, 70, 6, { z: 220 });
    ui.text('t1', 'SUPERVIVENCIA', 640, 190, { size: 24, align: 'center', color: PAL.orange });
    ui.text('t2', 'URBANA', 640, 230, { size: 24, align: 'center', color: PAL.orange });
    ui.text('t3', '"Llegar a la meta... si el Metro lo permite"', 640, 280, { size: 8, align: 'center', color: PAL.dim });
    for (var i = 0; i < total; i++) {           // un cuadrito por nivel: verde si ya lo completaste
      var ok = U.Save.isCompleted(i);
      ui.rect(640 - (total * 30 - 10) / 2 + i * 30, 312, 20, 20, { fill: ok ? '46;204;113' : i === next ? '255;200;60' : '40;40;70', border: '255;255;255', bw: 2 });
    }
    ui.text('prog', done + '/' + total + ' niveles completados', 640, 342, { size: 8, align: 'center', color: PAL.dim });
    var seen = U.session.seenTutorial;
    if (ui.button('play', '', 440, 364, 400, 84, { size: 8 }) && lv) {
      U.session.levelIndex = next; U.session.afterTutorial = 'Nivel'; go(scene, seen ? 'Nivel' : 'Tutorial');
    }
    ui.text('pl1', 'JUGAR', 640, 374, { size: 24, align: 'center' });
    ui.text('pl2', lv ? 'NIVEL ' + lv.id + ' - ' + lv.day : 'Cargando...', 640, 408, { size: 12, align: 'center', color: '255;235;180' });
    if (lv) ui.text('pl3', lv.start + ' > ' + lv.goal, 640, 430, { size: 8, align: 'center', color: '255;220;190' });
    if (ui.button('sel', 'SELECCIONAR NIVEL', 490, 462, 300, 44, { size: 8, fill: '70;70;100' })) m.view = 'levels';
    if (ui.button('how', 'COMO JUGAR', 490, 516, 300, 40, { size: 8, fill: '70;70;100' })) { U.session.afterTutorial = 'Menu'; go(scene, 'Tutorial'); }
  }

  /** Selector: solo se pueden rejugar los niveles ya completados; el siguiente se juega con JUGAR. */
  function drawLevels(scene, ui, m, data) {
    ui.text('h', 'SELECCIONAR NIVEL', 640, 56, { size: 24, align: 'center', color: PAL.yellow });
    ui.text('hs', 'Solo puedes rejugar los niveles que ya completaste.', 640, 102, { size: 8, align: 'center', color: PAL.dim });
    var total = data ? data.levels.length : 0, next = U.Save.nextLevel(total), W = 220, G = 16, x0 = (1280 - (total * W + (total - 1) * G)) / 2;
    data && data.levels.forEach(function (lv, i) {
      var ok = U.Save.isCompleted(i), cur = !ok && i === next, x = x0 + i * (W + G), y = 150;
      ui.rect(x, y, W, 380, { fill: ok ? '22;48;38' : cur ? '48;42;20' : '20;20;38', border: ok ? '46;204;113' : cur ? '255;200;60' : '60;60;90', bw: 3 });
      ui.text('n' + i, String(lv.id), x + W / 2, y + 18, { size: 24, align: 'center', color: ok ? PAL.green : cur ? PAL.yellow : '90;90;120' });
      ui.text('d' + i, lv.day, x + W / 2, y + 62, { size: 12, align: 'center', color: ok || cur ? '255;255;255' : '110;110;140' });
      ui.text('sl' + i, 'SALIDA', x + 14, y + 100, { size: 8, color: PAL.dim });
      ui.lines('s' + i, util.wrap(lv.start, 24), x + 14, y + 116, { size: 8, lineH: 12, color: ok || cur ? '230;234;250' : '90;90;120' });
      ui.text('ml' + i, 'META', x + 14, y + 160, { size: 8, color: PAL.dim });
      ui.lines('g' + i, util.wrap(lv.goal, 24), x + 14, y + 176, { size: 8, lineH: 12, color: ok || cur ? '230;234;250' : '90;90;120' });
      if (ok) {
        ui.icon('ck' + i, 'meta', x + W / 2 - 16, y + 218, 2);
        ui.text('st' + i, 'COMPLETADO', x + W / 2, y + 262, { size: 8, align: 'center', color: PAL.green });
        if (ui.button('re' + i, 'REJUGAR', x + 14, y + 300, W - 28, 52, { size: 8, fill: '39;174;96' })) { U.session.levelIndex = i; U.session.afterTutorial = 'Nivel'; go(scene, 'Nivel'); }
      } else if (cur) {
        ui.text('st' + i, 'SIGUIENTE', x + W / 2, y + 236, { size: 12, align: 'center', color: PAL.yellow });
        ui.lines('sg' + i, ['Entra con el boton', 'JUGAR del menu'], x + W / 2, y + 276, { size: 8, lineH: 14, align: 'center', color: '230;214;160' });
      } else {
        ui.icon('lk' + i, 'bloqueo', x + W / 2 - 16, y + 218, 2, { opacity: 120 });
        ui.text('st' + i, 'BLOQUEADO', x + W / 2, y + 262, { size: 8, align: 'center', color: '110;110;140' });
        ui.lines('sg' + i, ['Completa el', 'nivel anterior'], x + W / 2, y + 296, { size: 8, lineH: 14, align: 'center', color: '90;90;120' });
      }
    });
    if (ui.button('back', 'VOLVER', 490, 574, 300, 48, { size: 8, fill: '70;70;100' })) m.view = 'main';
    var ask = m.resetAsk > m.t;                                            // borrar el progreso pide confirmación (segundo toque en 3 s)
    if (ui.button('wipe', ask ? 'SEGURO? TOCA OTRA VEZ' : 'BORRAR PROGRESO', 960, 658, 290, 36, { size: 8, fill: ask ? '200;60;50' : '110;50;50' })) {
      if (ask) { U.Save.reset(); m.resetAsk = 0; } else m.resetAsk = m.t + 3;
    }
  }

  U.Scenes.menu = function (scene) {
    var ui = U.UI.of(scene), m = scene._um || init(scene), dt = Math.min(0.1, scene.getElapsedTime() / 1000), data = U.Data.ready(scene);
    U.Save.load();
    m.t += dt; ui.begin();
    m.stars.forEach(function (s) { ui.rect(s[0], s[1], 4, 4, { fill: Math.sin(m.t * 2 + s[2]) > 0 ? '255;255;255' : '120;120;160', bw: 0 }); });
    m.train.setX(((m.t * 220) % 1900) - 300);
    ui.rect(0, 700, 1280, 20, { fill: '10;8;20', border: '10;8;20', bw: 0 });
    if (m.view === 'levels') drawLevels(scene, ui, m, data); else drawMain(scene, ui, m, data);
    ui.text('ver', 'v' + U.VERSION + '  -  hecho con GDevelop', 640, 684, { size: 8, align: 'center', color: '90;90;120' });
    ui.end();
  };
})();
