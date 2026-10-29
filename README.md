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
  data/*.json          estaciones, conexiones, niveles, noticias y economía  ← aquí se edita el juego
src/                   módulos JavaScript (fuente de verdad del código)
tools/                 generadores y solucionador de balance
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

## Combis y doble clic

- **Rutas de combi:** 8 conexiones extra (4.º valor `"combi"` en `conexiones.json`) unen estaciones algo separadas que el Metro no conecta directo: Colegio Militar–Guerrero, Balderas–Zócalo, Deportivo 18 de Marzo–Eduardo Molina, Buenavista–San Cosme, Isabel la Católica–Lagunilla, Merced–Moctezuma, San Lázaro LB–Terminal Aérea y Morelos–San Antonio Abad. En el mapa son líneas **naranjas punteadas** con un microbús; en el panel de viaje aparecen como `COMBI`.
- **Reglas:** cada tramo cuesta `config.combi` (hoy $10 y 5 de stamina, el Metro cuesta $5 y 5 por estación) y el tiempo indicado en la conexión. No les afectan las fallas de las líneas del Metro (sí los bloqueos de sus estaciones) y nunca cuentan como transbordo.
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
