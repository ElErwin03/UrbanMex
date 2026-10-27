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
| `map` | mapa 2D, cámara, estaciones, jugador | sí |
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
