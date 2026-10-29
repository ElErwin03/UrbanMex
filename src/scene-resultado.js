/* UrbanMex · escena Resultado — fin de cada jornada. Objetos: Texto, Icono, UIBase, UIModal. */
(function () {
  var U = gdjs.UrbanMex, PAL = U.UI.PAL;
  U.Scenes = U.Scenes || {};
  if (U.Scenes.resultado) return;

  U.Scenes.resultado = function (scene) {
    var ui = U.UI.of(scene), r = U.session.lastResult, data = U.Data.ready(scene);
    ui.begin();
    if (!r || !data) {
      ui.text('x', 'Sin resultado', 640, 340, { size: 16, align: 'center' });
      if (ui.button('m', 'MENU', 540, 400, 200, 44, {})) scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, 'Menu');
      ui.end(); return;
    }
    var last = !U.Rules.hasNextLevel(data, r.levelIndex), week = r.won && last;
    ui.text('t', r.won ? 'LLEGASTE!' : 'GAME OVER', 640, 70, { size: 24, align: 'center', color: r.won ? PAL.green : PAL.red });
    ui.text('d', 'NIVEL ' + (r.levelIndex + 1) + ' - ' + r.day, 640, 118, { size: 8, align: 'center', color: PAL.dim });
    if (!r.won) ui.text('why', r.reason, 640, 150, { size: 8, align: 'center', color: PAL.yellow });
    var rows = [['reloj', 'Hora de llegada', r.arrival], ['reloj', 'Tiempo de viaje', r.travelTime], ['persona', 'Estaciones', String(r.steps)],
                ['moneda', 'Dinero', String(r.money)], ['alerta', 'Asaltos', r.robbed + ' (-' + r.stolen + ')'], ['noticia', 'Noticias recibidas', String(r.newsRead)]];
    rows.forEach(function (row, i) {
      var y = 190 + i * 50;
      ui.rect(380, y, 520, 42, { fill: '24;24;46', border: '60;60;90', bw: 2 });
      ui.icon('ri' + i, row[0], 394, y + 5, 2); ui.text('rl' + i, row[1], 440, y + 17, { size: 8, color: PAL.dim });
      ui.text('rv' + i, row[2], 884, y + 17, { size: 8, align: 'right' });
    });
    if (week) ui.text('w', 'COMPLETASTE LA SEMANA! Eres un sobreviviente del transporte urbano.', 640, 506, { size: 8, align: 'center', color: PAL.yellow });
    var go = function (name) { scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, name); };
    if (r.won && !last) {
      if (ui.button('n', 'SIGUIENTE NIVEL >', 400, 560, 300, 52, { size: 8, fill: '39;174;96' })) { U.session.levelIndex = r.levelIndex + 1; go('Nivel'); }
    } else if (!r.won) {
      if (ui.button('r', 'REINTENTAR', 400, 560, 300, 52, { size: 8 })) { U.session.levelIndex = r.levelIndex; go('Nivel'); }
    } else if (ui.button('a', 'JUGAR OTRA VEZ', 400, 560, 300, 52, { size: 8, fill: '39;174;96' })) { U.session.levelIndex = 0; go('Nivel'); }
    if (ui.button('m', 'MENU', 730, 560, 150, 52, { size: 8, fill: '70;70;100' })) go('Menu');
    ui.end();
  };
})();
