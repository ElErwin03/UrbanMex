# Supervivencia Urbana — Metro CDMX (GDevelop)

Juego 2D pixel-art para **PC con Windows** (exportable desde GDevelop): llega de tu casa a tu destino por el Metro de la CDMX
antes de que anochezca, usando el celular (noticias) como única guía. Basado en el *Lienzo del Modelo de Juego*.

## Cómo abrirlo
1. Abre **GDevelop 5.6+** → *Abrir proyecto* → `My project/UrbanMex.json`.
2. Escena inicial: `Menu`. Pulsa *Vista previa*. Exporta desde *Archivo → Exportar*.

## Estructura
```
My project/
  UrbanMex.json        proyecto de GDevelop (GENERADO, ver abajo)
  assets/img/          pixel art (generado con tools/make_art.py)
  assets/fonts/        Press Start 2P (licencia OFL incluida)
  assets/audio/        música, tren y efectos .ogg (generado con tools/make_audio.py)
  data/*.json          estaciones, conexiones, niveles, noticias y economía  ← aquí se edita el juego
src/                   módulos JavaScript (fuente de verdad del código)
tools/                 generadores, solucionador de balance y vista previa sin GDevelop
tests/                 pruebas (lógica + proyecto completo sobre un motor simulado)
```

## Modularidad
| Módulo (`src/`) | Qué hace | Depende del motor |
|---|---|---|
| `core` | espacio de nombres `gdjs.UrbanMex`, sesión, utilidades | no |
| `data` | carga/valida los JSON (recursos del proyecto) | mínimo |
| `graph` | red del Metro, rutas, alcanzabilidad | no |
| `rules` | economía, viaje, asaltos, Monster, fin de partida | no |
| `news` | noticias del celular (nunca dejan la meta inalcanzable) | no |
| `ui` | interfaz “modo inmediato” sobre objetos Texto/Icono/Painter | sí |
| `map` | mapa isométrico 2.5D (ciudad en relieve), cámara que encuadra toda la red, estaciones, jugador | sí |
| `phone` | celular: Noticias, Ruta, Saldo, Ajustes | sí |
| `fx` | efectos visuales: iluminación dinámica, partículas, bruma, viñeta (ver *Efectos visuales*) | sí |
| `audio` | música de fondo, tren lejano cada 60 s y efectos de interfaz (ver *Música y sonido*) | sí |
| `scene-*` | controlador de cada escena (Menu, Tutorial, Nivel, Resultado) | sí |

En GDevelop cada módulo es una hoja de **eventos externos** `Mod_<nombre>` y cada escena los enlaza.

> **Flujo de trabajo:** el código vive en `src/`. Tras editarlo ejecuta `python3 tools/build_project.py` para regenerar
> `UrbanMex.json`. Si prefieres editar dentro de GDevelop, hazlo en las hojas `Mod_*` y copia el cambio de vuelta a `src/`
> antes de volver a generar (el generador sobrescribe las escenas y los eventos externos).
> Para cambiar **datos o balance** no hace falta tocar código: edita `My project/data/*.json`.

## Pruebas y balance
```
npm test            # 10 pruebas de reglas + prueba de humo (un bot juega 5 días con clics sobre el proyecto generado)
npm run balance     # ¿todos los niveles son ganables? (tools/solver.py)
```

## Progreso y selector de niveles

- **Guardado:** al ganar un nivel se guarda el progreso (niveles completados, y los ajustes: doble clic y tutorial visto) en `localStorage` con la clave `UrbanMex_save_v1` (`U.Save` en `src/core.js`). Es el mismo almacenamiento que usan las acciones de *Almacenamiento* de GDevelop: persiste entre partidas en el navegador y en las exportaciones de escritorio/móvil. Sin almacenamiento disponible el progreso solo dura la sesión.
- **JUGAR:** siempre te lleva al primer nivel que aún no has completado (si perdiste un nivel, vuelves a él; si ya completaste todos, al último) y el botón dice a cuál entras: `JUGAR / NIVEL 3 - MIÉRCOLES / Cuatro Caminos > Tasqueña`, con un cuadrito por nivel (verde = completado) y el contador de niveles completados.
- **SELECCIONAR NIVEL:** muestra los 5 niveles; solo los completados tienen botón `REJUGAR`. El siguiente aparece como `SIGUIENTE` (se entra con JUGAR) y los demás como `BLOQUEADO`. `BORRAR PROGRESO` (pide un segundo toque para confirmar) reinicia el guardado.
- Todo el juego usa ahora la palabra **NIVEL** (antes DÍA) en el menú, el HUD, el aviso de inicio y el resultado.

## Combis y doble clic

- **Rutas de combi:** 9 conexiones extra (4.º valor `"combi"` en `conexiones.json`) unen estaciones algo separadas que el Metro no conecta directo: Colegio Militar–Guerrero, Balderas–Zócalo, Deportivo 18 de Marzo–Eduardo Molina, Buenavista–San Cosme, Isabel la Católica–Lagunilla, Merced–Moctezuma, San Lázaro LB–Terminal Aérea, Morelos–San Antonio Abad y **Coyoacán (L3)–Pantitlán (L1)**. En el mapa son líneas **naranjas punteadas** con un microbús; en el panel de viaje aparecen como `COMBI`.
- **Reglas:** cada tramo cuesta `config.combi` (hoy $10 y 5 de stamina, el Metro cuesta $5 y 5 por estación) y el tiempo indicado en la conexión. No les afectan las fallas de las líneas del Metro (sí los bloqueos de sus estaciones) y nunca cuentan como transbordo.
- **Combi larga con tarifa propia:** Coyoacán–Pantitlán (≈12 casillas) cuesta 35 min, $40 y 55 de stamina (`[a, b, tiempo, "combi", dinero, stamina]` en `conexiones.json`); con la tarifa normal rompía el balance de los niveles 2 a 5.
- **Balance:** se eligieron con un solucionador para que ningún día se vuelva trivial: los días 2 a 5 siguen exigiendo comprar Monster (`npm run balance`).
- **Doble clic = viajar sin confirmar:** doble clic en una estación **vecina** (conectada a la que ocupa el jugador, por Metro, transbordo o combi) viaja ahí de inmediato, sin abrir el panel de confirmación. Con cualquier otra estación funciona como un clic normal (no viaja). Se activa y desactiva en **celular > AJUSTES > DOBLE CLIC VIAJAR** (por defecto, activado).

## Mapa isométrico

- La cuadrícula lógica (`x`, `y` en `estaciones.json`) no cambió; `src/map.js` solo la proyecta: `pantalla.x = OX + (x - y) * 24`, `pantalla.y = OY + (x + y) * 12` (casilla de 48x24 px, estilo Age of Empires / Clash of Clans).
- Bajo las líneas hay una isla de ciudad con edificios en relieve (`EdificioIso`, sprites `iso_edificio_*.png` y `iso_parque.png`), avenidas y andenes de colores. El suelo se dibuja una sola vez; cada fotograma solo se redibujan las vías.
- Al abrir un día la cámara **encuadra toda la red** (sin mover ni acercar). Controles arriba a la izquierda: `-` / `+` (zoom), `TODO` (volver al encuadre), `YO` (seguir al jugador con zoom) y `ABC` (mostrar todos los nombres; por defecto solo se ven los de la estación actual, la meta, el inicio, las vecinas y la que señalas).

## Celular, líneas y tiendas

- **Celular ocultable:** el botón `X` de su esquina lo oculta (el mapa se centra en todo el ancho) y el icono de la esquina superior derecha lo vuelve a mostrar. Si llegan noticias con el celular oculto, el icono parpadea con el número de noticias sin leer; al abrirlo va directo a Noticias.
- **Avisos dentro del celular:** una noticia nueva aparece como notificación en la parte alta de la pantalla del propio celular (tocarla abre Noticias). Ya no hay ventanas flotantes fuera del celular.
- **App LINEAS:** muestra el color de cada línea (1 rosa, 2 azul, 3 verde, 5 amarilla, B gris), cuántas estaciones tiene y, al tocarla, la resalta en el mapa. También explica qué es un bloqueo (se cierra *solo esa estación*, no toda la línea), un peligro y un retraso. Las tarjetas de noticias llevan cuadritos con el color de las líneas que tocan y los textos dicen el color ("LÍNEA 3 (VERDE)").
- **Tiendas:** además de las 7 originales hay 3 nuevas (`Balderas`, `San Antonio Abad`, `Guerrero`), elegidas por estar en nodos centrales a mitad de camino de varias jornadas y lejos de otra tienda; así cada jornada tiene al menos 3 tiendas junto a su ruta más corta. Se definen en `tools/make_data.py` (`EXTRA_SHOPS`) y en `estaciones.json` (`"shop": true`).
- Noticias, avisos y ventanas de inicio de día usan letra de 12 px (antes 8 px).
- Probar sin GDevelop: `npm test` (incluye comprobar que ninguna estación queda fuera de pantalla ni bajo la interfaz).

## Noticias y bloqueos

- **Las noticias solo ocurren cuando el jugador se mueve:** nunca llegan con el reloj o mientras piensas. La primera (siempre de seguridad) llega tras el primer movimiento y después una cada 2 o 3 movimientos con 75 % de probabilidad (`config.news`: `firstAfterMoves`, `everyMoves`, `chance`; `News.onMove` en `src/news.js`). Una noticia nunca repite un bloqueo que ya existe en el nivel.
- **Bloqueos al empezar cada nivel:** N2 **Juárez** y **Zócalo** · N3 **Allende** · N4 **Tlatelolco** y **Pantitlán** (línea 1) · N5 Isabel la Católica, Pino Suárez, Candelaria y **Coyoacán** (definidos en `LV` de `tools/make_data.py`).
- **Estaciones eliminadas del juego:** Niños Héroes y Potrero (línea 3), Popotla y Xola (línea 2). La línea sigue pasando: sus vecinas quedan conectadas directo (un tramo normal de 5 min). Son 79 estaciones y 85 tramos de Metro.
- **Balance:** al acortarse las rutas se bajó la stamina máxima de N2 (100), N3 (90) y N4 (105) para que los niveles 2 a 5 sigan exigiendo comprar Monster (`npm run balance`).

## Efectos visuales

Capa de acabado "alta fidelidad" sobre el dibujo original: **no cambia ningún personaje, objeto ni composición**, solo luz, material y atmósfera.

- **Arte (`tools/make_art.py`)**: los sprites conservan siluetas, tamaños y ventanas encendidas, pero ahora tienen material (degradado con oclusión ambiental junto al suelo, juntas de piso, grano sutil), luz cálida desde la izquierda y ambiente frío en sombra, ventanas con brillo y aristas suavizadas en lugar de líneas negras. Los 10 sprites `fx_*.png` (luz, mota, niebla, viñeta, destello, sombra, haz, bruma) son suaves y se marcan con suavizado en el proyecto; el pixel art sigue en `nearest`.
- **Suelo y vías (`src/map.js`)**: asfalto con degradado y grano, bordillos, manzanas con relieve, **sombras suaves** de cada edificio (según su altura, hacia la derecha y abajo), charcos de luz bajo cada estación, vías con halo y reflejo.
- **Iluminación dinámica (`src/fx.js`, capa `FX` entre el mapa y la interfaz)**: luz bajo cada estación (más fuerte en la actual, la meta, el inicio, las vecinas y las que señalas), luz cálida y sombra de contacto que siguen al jugador, haz de luz en la meta y **gradación según la hora del nivel** (mañana cálida → mediodía → hora dorada → anochecer violeta).
- **Partículas sutiles**: polvo y bokeh con **paralaje** al mover la cámara, bancos de niebla a la deriva y destellos en la meta, el inicio y las tiendas. Sus posiciones son una función pura del tiempo (reproducibles).
- **Profundidad de campo ligera**: bruma arriba (lo lejano), oscurecimiento abajo y viñeta; el menú suma resplandor de ciudad, luz del tren y estrellas que centellean; Tutorial y Resultado llevan viñeta, bruma y polvo (resplandor verde o rojo según ganes o pierdas).
- **Calidad**: `U.session.fxQuality = 'high'` (por defecto) | `'low'` (menos partículas y luces) | `'off'` (sin efectos; vuelve la sombra original del jugador).
- **Vista previa sin GDevelop**: `node tools/dump_scene.js . Nivel salida.json --level 1 --minute 1150` y `python3 tools/render_preview.py salida.json . salida.png` generan un PNG aproximado (soporta mezcla aditiva y multiplicar). No es el render real de la GPU ni reproduce efectos de capa de GDevelop.

## Música y sonido

Todo el audio se **sintetiza** con `python3 tools/make_audio.py` (numpy + scipy + ffmpeg con libvorbis): no hay muestras ni descargas, así que no hay derechos de terceros. Los volúmenes (0 a 100) están en `src/audio.js` y son bajos a propósito.

| Archivo | Qué es | Volumen en el juego |
|---|---|---|
| `musica_menu.ogg` (64 s) | pad cálido y arpegios suaves de piano eléctrico (Am9 · Fmaj9 · Cmaj9 · G6). Menú, Tutorial y Resultado | 40 |
| `musica_nivel.ogg` (58 s) | más luminosa, lenta y espaciada (Dmaj9 · Bm9 · Gmaj9 · A6/9). Durante el nivel | 40 |
| `tren_a.ogg` / `tren_b.ogg` (16 s) | tren lejano: retumbo, zumbido con efecto Doppler, soplo de aire y golpeteo entre vagones; pasa de izquierda a derecha y al revés | 28 |
| `sfx_*.ogg` | clic, selección, viaje, noticia, moneda, tienda, suerte, error, ganar y perder | 34 a 48 |
| `peligro_loop.ogg` (5 s) | **apuro**: latido a 96 lpm (con armónicos medios para que se oiga en bocinas chicas) + tic-tac + pitido tenso (segunda menor) + zumbido grave, bucle sin costura | 46 |
| `sfx_alerta.ogg` (0.6 s) | aviso de dos pitidos agudos y un golpe grave, una sola vez al **entrar** en apuro | 46 |
| `sfx_asalto.ogg` (~1.3 s) | **asalto**: golpe seco de ataque brusco (ráfaga de ruido, golpe grave y racimo disonante); reemplaza al antiguo `sfx_robo` | 46 |

- **Tren de fondo:** suena **cada 60 s** (el primero a los 20 s), alternando el lado por el que pasa, unos 8 dB por debajo de la música para que apenas se note (`TRAIN_EVERY`, `TRAIN_FIRST` y `TRAIN_VOL` en `src/audio.js`).
- **Música:** las dos pistas son bucles sin costura (la cola de la reverb da la vuelta). Al pasar de una a otra, la anterior baja con un fundido de 1.8 s; entre Menú, Tutorial y Resultado la música no se reinicia (por eso las escenas tienen `stopSoundsOnStartup` en falso).
- **Tres módulos de volumen** (Menú → `SONIDO`, y en el celular la app `SONIDO`, también desde AJUSTES): cada uno con sus botones `-` / `+`, una barra de 10 pasos (se toca el paso que quieras) y `MUDO` / `ACTIVAR`:
  - **MUSICA GENERAL:** la música de fondo. Se oye el cambio en vivo y sin saltos.
  - **SONIDOS GENERALES:** clics, selección, viaje, noticias, moneda, tienda, suerte, error, ganar / perder y el tren lejano.
  - **PELIGRO Y APURO:** el latido de apuro y el golpe de asalto.
  El nivel va de 0 a 10; el 7 (de fábrica) deja los volúmenes base de la tabla, y el 10 los sube ×1.43. Los tres se guardan con el progreso (`vol` en `UrbanMex_save_v1`); un guardado anterior con el interruptor único `audio: false` se entiende como los tres en silencio. Al cambiar un nivel suena una muestra (la del asalto no se repite en menos de 0.7 s).
- **Apuro:** mientras queda **menos del 15 % del tiempo del día, del dinero** con el que empezó el nivel **o de la energía** (stamina) máxima (y la partida sigue; con 0 de dinero o de energía la partida termina), entra con un fundido de 1.6 s el latido (canal de música 2) y la música baja a 60 % para que se note; al dejar de haber apuro, o al terminar la partida, sale con un fundido de 1.2 s. Con el módulo en MUDO no suena ni baja la música. El umbral y los volúmenes están en `ALERT` de `src/audio.js`.
- **Asalto:** al ser asaltado suena `sfx_asalto` con el volumen de PELIGRO Y APURO (silenciar los sonidos generales no lo silencia).
- **Para cambiar la música:** edita los acordes en `compose(...)` de `tools/make_audio.py` y vuelve a ejecutarlo; luego `python3 tools/build_project.py`.
- Los navegadores no dejan reproducir audio hasta el primer clic de la persona; GDevelop/Howler lo reintenta solo en cuanto hay interacción.

## Responsivo (cualquier ventana)
La interfaz y el mundo están dibujados en coordenadas fijas de 1280x720, así que el juego mantiene esa resolución lógica
(`adaptGameResolutionAtRuntime: false`, `sizeOnStartupMode: ""`). GDevelop escala el lienzo para que quepa entero en la ventana,
conservando la proporción 16:9 y centrándolo: en ventanas verticales o muy anchas aparecen franjas oscuras arriba/abajo o a los lados,
pero nada se recorta y los clics siguen cayendo en el botón correcto. Antes la resolución se adaptaba al ancho de la ventana y, en
ventanas estrechas, el menú y el mapa quedaban cortados. En móvil conviene jugar en horizontal (`orientation: landscape`).

## Mapa menos saturado (estaciones y rutas secundarias)
La cuadrícula lógica de `estaciones.json` no cambia; `src/layout.js` (funciones puras) decide cómo se acomoda en pantalla:
- **Estaciones más separadas:** el mapa multiplica las coordenadas por `K = 1.3` (antes las líneas 2 y 3 tenían las estaciones a una sola casilla y se tocaban). La cámara encuadra la red completa, por eso el zoom inicial baja de ~97% a ~76%.
- **Plaza despejada:** alrededor de cada estación (1.9 casillas) no hay edificios ni parques, y en 3.2 casillas solo edificios bajos. La ciudad tiene menos densidad (40% edificios, 10% parques, antes 52% y 8%) y las calles de todas las rutas quedan libres. Los edificios siempre se dibujan por debajo de las vías.
- **Combis y transbordos por las calles:** ya no son diagonales rectas que cruzan todo el mapa. Siguen la cuadrícula (tramos en los ejes, máximo 2 codos); para cada ruta se elige, entre unos 40 trazados candidatos, el que menos se encima con el Metro, menos lo cruza, menos pasa pegado a estaciones ajenas y menos se mezcla con otras rutas secundarias. Es determinista. Las líneas del Metro siguen rectas. Se dibujan como calle angosta con codos redondeados, el jugador las recorre siguiendo los codos y el microbús va a la mitad del recorrido.
- Los nombres de estación crecen hasta 35% cuando el zoom baja de 100%, para seguir legibles.
Los ajustes (`K`, `PLAZA`, `CALM`, `BUILD_P`, pesos del puntaje) están al inicio de `src/layout.js` y `src/map.js`.

## Salir del juego
El menú principal tiene un botón **SALIR** hasta abajo. Abre la ventana «SALIR DEL JUEGO» (CANCELAR / SI, SALIR); con SI se guarda el progreso y se pide cerrar el juego (`STOP_GAME`, que cierra la ventana de GDevelop o la app de escritorio / móvil). Un navegador no deja que un juego cierre su propia pestaña, así que ahí se muestra «GRACIAS POR JUGAR! Ya puedes cerrar esta ventana.» con un botón para volver al menú. Mientras la ventana está abierta, nada de lo de abajo responde al ratón.

## Pausa dentro del nivel
Se pausa con **Esc**, con **P** o con el botón **PAUSA** de la barra de arriba (junto al celular). No hay pausa cuando el día ya terminó.

- **Qué se congela:** el mapa y el jugador (un viaje a medias espera y termina al continuar), los efectos, los mensajes flotantes y avisos del celular, y el reloj del tren de 60 s. El reloj del juego solo avanza al viajar, así que no corre mientras tanto.
- **Audio en pausa:** la música baja a 35 % (`ALERT.pauseDuck`), el bucle de apuro se apaga con fundido y, al continuar, vuelve **sin repetir** el aviso de entrada.
- **Menú:** CONTINUAR · SONIDO (los tres volúmenes con MUDO, el mismo panel del menú principal) · SALIR AL MENU, que pide confirmación (CANCELAR / SI, SALIR). En SONIDO o en la confirmación, Esc regresa un paso.
- Lo de abajo se ve atenuado y no responde al ratón; un aviso pendiente (noticia, evento) reaparece al continuar.
- Vista previa: `node tools/dump_scene.js . Nivel out.json --pause main|sound|confirm` y luego `render_preview.py`.
