/* UrbanMex · escena Menú — título, skyline pixel-art y tren animado. Objetos: Texto, Icono, UIBase, UIModal, Edificio, Tren. */
(function () {
  var U = gdjs.UrbanMex, util = U.util, PAL = U.UI.PAL;
  U.Scenes = U.Scenes || {};
  if (U.Scenes.menu) return;

  function init(scene) {
    var m = scene._um = { t: 0, buildings: [], train: scene.createObject('Tren'), stars: [] };
    var rnd = util.seeded(7);
    for (var i = 0; i < 14; i++) {
      var b = scene.createObject('Edificio'); b.setAnimationName('e' + (i % 4)); b.setScale(3);
      b.setPosition(i * 96 - 20, 720 - 96 - rnd() * 60); b.setZOrder(1); m.buildings.push(b);
    }
    m.train.setScale(3); m.train.setZOrder(2); m.train.setPosition(-300, 604);
    for (var s = 0; s < 40; s++) m.stars.push([rnd() * 1280, rnd() * 300, rnd() * 6]);
    return m;
  }

  U.Scenes.menu = function (scene) {
    var ui = U.UI.of(scene), m = scene._um || init(scene), dt = Math.min(0.1, scene.getElapsedTime() / 1000);
    m.t += dt; ui.begin();
    m.stars.forEach(function (s) { ui.rect(s[0], s[1], 4, 4, { fill: Math.sin(m.t * 2 + s[2]) > 0 ? '255;255;255' : '120;120;160', bw: 0 }); });
    m.train.setX(((m.t * 220) % 1900) - 300);
    ui.rect(0, 700, 1280, 20, { fill: '10;8;20', border: '10;8;20', bw: 0 });
    ui.icon('logo', 'meta', 592, 70, 6, { z: 220 });
    ui.text('t1', 'SUPERVIVENCIA', 640, 190, { size: 24, align: 'center', color: PAL.orange });
    ui.text('t2', 'URBANA', 640, 230, { size: 24, align: 'center', color: PAL.orange });
    ui.text('t3', '"Llegar a la meta... si el Metro lo permite"', 640, 290, { size: 8, align: 'center', color: PAL.dim });
    var seen = U.session.seenTutorial;
    if (ui.button('play', 'JUGAR', 490, 350, 300, 52, { size: 16 })) {
      U.session.levelIndex = 0; scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, seen ? 'Nivel' : 'Tutorial');
    }
    if (ui.button('how', 'COMO JUGAR', 490, 420, 300, 40, { size: 8, fill: '70;70;100' })) scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, 'Tutorial');
    ui.text('ver', 'v' + U.VERSION + '  -  hecho con GDevelop', 640, 676, { size: 8, align: 'center', color: '90;90;120' });
    ui.end();
  };
})();
