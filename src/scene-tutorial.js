/* UrbanMex · escena Tutorial — cómo jugar. Objetos: Texto, Icono, UIBase, UIModal. */
(function () {
  var U = gdjs.UrbanMex, PAL = U.UI.PAL;
  U.Scenes = U.Scenes || {};
  if (U.Scenes.tutorial) return;

  var ROWS = [
    ['meta', 'OBJETIVO', 'Viaja por la CDMX desde tu casa hasta tu destino antes de que anochezca (8:00 PM).'],
    ['noticia', 'EL CELULAR ES TU GUIA', 'Las noticias avisan de robos, bloqueos y retrasos. El mapa NO te advierte. Leelas!'],
    ['alerta', 'PELIGRO', 'En estaciones reportadas te pueden asaltar. Si ignoras las noticias, pierdes peje-coins.'],
    ['reloj', 'TIEMPO', 'El reloj avanza solo cuando viajas: estacion 5 min, transbordo 12 min mas los retrasos.'],
    ['rayo', 'STAMINA', 'Cada estacion cansa. Compra Monster en las tiendas del Metro para recuperarla.'],
    ['moneda', 'DINERO', 'Cada estacion cuesta pasaje en peje-coins. Cuidado: si te quedas sin nada, pierdes.']
  ];

  U.Scenes.tutorial = function (scene) {
    var ui = U.UI.of(scene); ui.begin();
    (scene._umFx || (scene._umFx = U.FX.ambient(scene, 'neutral'))).update(Math.min(0.1, scene.getElapsedTime() / 1000));   // viñeta, bruma y polvo suaves
    ui.text('h', 'COMO JUGAR', 640, 28, { size: 24, align: 'center', color: PAL.yellow });
    ROWS.forEach(function (r, i) {
      var y = 90 + i * 84;
      ui.rect(120, y, 1040, 74, { fill: '24;24;46', border: '60;60;90', bw: 2 });
      ui.icon('ic' + i, r[0], 140, y + 13, 3);
      ui.text('lb' + i, r[1], 214, y + 12, { size: 16, color: PAL.orange });
      ui.text('tx' + i, r[2], 214, y + 42, { size: 8, cols: 110, color: '210;214;232' });
    });
    if (ui.button('ok', 'ENTENDIDO!', 490, 618, 300, 52, { size: 16, fill: '39;174;96' })) {
      U.session.seenTutorial = true; U.Save.persist();                               // desde COMO JUGAR vuelve al menú; desde JUGAR sigue al nivel elegido
      scene.requestChange(gdjs.SceneChangeRequest.REPLACE_SCENE, U.session.afterTutorial || 'Nivel');
    }
    ui.end();
  };
})();
