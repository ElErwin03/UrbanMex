#!/usr/bin/env python3
"""Genera "My project/data/*.json" a partir de los datos originales del juego HTML/JS
(extraídos a orig_data.json) aplicando las correcciones de balance y de mapa.
Se conserva en el repo para documentar qué se cambió y por qué; los JSON de data/ son
la fuente editable a partir de ahora."""
import json, re, sys, os
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'orig_data.json')
out = sys.argv[2] if len(sys.argv) > 2 else 'My project/data'
d = json.load(open(src))
os.makedirs(out, exist_ok=True)

EMOJI = re.compile('[\U0001F000-\U0001FAFF\u2300-\u23FF\u2600-\u27BF\uFE0F\u200D]+')   # incluye ⏱ (la fuente pixelada no lo dibuja)
def clean(s):
    return re.sub(r'\s+', ' ', EMOJI.sub('', s)).strip()

# ---- config -----------------------------------------------------------
config = {
  "currencyName": "peje-coins",
  "dayStartMinute": 420, "dayEndMinute": 1200,
  "stationTime": 5, "transferTime": 12, "minEdgeTime": 3,
  "staminaPerStation": 5, "moneyPerStation": 5,
  "monsterPrice": 30, "monsterPromoPrice": 20, "monsterStamina": 40,
  "robbery": {"baseChance": 0.55, "luck": 0.15, "minLoss": 20, "maxLoss": 59},
  "news": {"firstDelaySec": 2, "intervalSec": [10, 18], "chance": 0.5},
  "combi": {"money": 10, "stamina": 5}      # tarifa y esfuerzo de UN tramo en combi (el Metro cuesta 5 y 5 por estación)
}

# ---- estaciones --------------------------------------------------------
LINES = {   # colorName: cómo se dice el color de la línea en el juego (celular > LÍNEAS y noticias)
  "1": {"name": "Línea 1", "color": "#E91E63", "colorName": "rosa"}, "2": {"name": "Línea 2", "color": "#2196F3", "colorName": "azul"},
  "3": {"name": "Línea 3", "color": "#8BC34A", "colorName": "verde"}, "5": {"name": "Línea 5", "color": "#FFEB3B", "colorName": "amarilla"},
  "B": {"name": "Línea B", "color": "#9E9E9E", "colorName": "gris"}}
# Tiendas añadidas (además de las 7 originales): nodos centrales a mitad de camino de varias jornadas y lejos de otra tienda
# (Balderas: centro-oeste; San Antonio Abad: centro-este; Guerrero: norte). Ver README, sección "Tiendas".
EXTRA_SHOPS = {"Balderas", "San Antonio Abad", "Guerrero"}
FIX_POS = {"Guerrero LB": (9, 6), "Valle Gómez": (16, 3)}   # estaban encimadas con otra estación
stations = []
for name, s in d["STATIONS"].items():
    x, y = FIX_POS.get(name, (s["x"], s["y"]))
    stations.append({"id": name, "x": x, "y": y, "line": str(s["line"]), "shop": bool(s["shop"]) or name in EXTRA_SHOPS})
json.dump({"lines": LINES, "stations": stations}, open(f"{out}/estaciones.json", "w"), ensure_ascii=False, indent=1)
# Rutas de combi: unen estaciones algo separadas que el Metro no conecta directo (el 4.º valor es "combi").
# Elegidas con un solucionador para que ningún día se vuelva trivial (los días 2 a 5 siguen exigiendo Monster); tiempo ≈ 4 + 1.5 × distancia en casillas.
COMBIS = [
  ["Colegio Militar", "Guerrero", 12], ["Balderas", "Zócalo", 8], ["Deportivo 18 de Marzo", "Eduardo Molina", 10],
  ["Buenavista", "San Cosme", 8], ["Isabel la Católica", "Lagunilla", 12], ["Merced", "Moctezuma", 12],
  ["San Lázaro LB", "Terminal Aérea", 12], ["Morelos", "San Antonio Abad", 12]]
json.dump(d["CONNECTIONS"] + [c + ["combi"] for c in COMBIS], open(f"{out}/conexiones.json", "w"), ensure_ascii=False)

# ---- niveles (rebalanceados: ver tools/solver.py) ----------------------
# Balance verificado con tools/solver.py: todos ganables, robustos a mala suerte y (N2-N5) exigen comprar Monster.
LV = [
  {"blocked": [],                    "moneyStart": 150, "staminaMax": 100},   # Lunes: tutorial, se gana sin Monster
  {"blocked": ["Juárez"],            "moneyStart": 210, "staminaMax": 110},   # Martes
  {"blocked": ["Allende"],           "moneyStart": 210, "staminaMax": 100},   # Miércoles
  {"blocked": ["Tlatelolco"],        "moneyStart": 230, "staminaMax": 120},   # Jueves (antes: meta inalcanzable)
  {"blocked": ["Isabel la Católica", "Pino Suárez", "Pino Suárez L2", "Candelaria", "Candelaria LB", "Candelaria LB2"],
   "moneyStart": 170, "staminaMax": 90},                                        # Viernes
]
levels = []
for i, l in enumerate(d["LEVELS"]):
    levels.append({"id": i + 1, "day": l["day"], "start": l["start"], "goal": l["goal"],
      "startDesc": clean(l["startDesc"]), "goalDesc": clean(l["goalDesc"]),
      "moneyStart": l["moneyStart"], "staminaMax": l["staminaMax"], "blocked": l["blocked"]})
if LV:
    for lv, o in zip(levels, LV): lv.update(o)
json.dump(levels, open(f"{out}/niveles.json", "w"), ensure_ascii=False, indent=1)

# ---- noticias -----------------------------------------------------------
ICON = {"security": "alerta", "protest": "bloqueo", "delay": "reloj", "weather": "alerta", "positive": "moneda", "info": "noticia"}
news = []
for i, n in enumerate(d["NEWS"]):
    eff = {}
    if n.get("dangerStations"): eff["danger"] = n["dangerStations"]
    if n.get("blockStations"): eff["block"] = n["blockStations"]
    if n.get("timeMod"): eff["timeMod"] = {"line": str(n["timeMod"]["line"]), "extra": n["timeMod"]["extraCost"]}
    if n.get("staminaPenalty"): eff["staminaPenalty"] = n["staminaPenalty"]
    if n.get("monsterDiscount"): eff["monsterPromo"] = True
    if n.get("moneyBonus"): eff["freeRide"] = 1
    news.append({"id": f"n{i+1:02d}", "type": n["type"], "title": clean(n["title"]), "desc": clean(n["desc"]),
                 "impact": clean(n["impact"]), "severity": n["severity"], "icon": ICON[n["type"]], "effects": eff})
# El color de cada línea va en los textos ("LÍNEA 3 (VERDE)") y los bloqueos dicen que solo se cierra ESA estación, no toda la línea.
def tag_lines(t):
    def f(m):
        color = LINES[m.group(2)]["colorName"]
        return m.group(0) + " (" + (color.upper() if m.group(1).isupper() else color) + ")"
    return re.sub(r"(LÍNEA|Línea|línea) ([1235B])\b(?! \()", f, t)
for n in news:
    for k in ("title", "desc", "impact"): n[k] = tag_lines(n[k])
BLOCK_TEXT = {  # id: (título, impacto)
  "n11": ("PROTESTA EN INSURGENTES (LÍNEA 1 ROSA)", "Solo INSURGENTES está cerrada; el resto de la línea sigue"),
  "n12": ("BLOQUEO EN JUÁREZ (LÍNEA 3 VERDE)", "Solo JUÁREZ está cerrada; el resto de la línea sigue"),
  "n13": ("MARCHA EN REFORMA (BELLAS ARTES, LÍNEA 2 AZUL)", "Solo BELLAS ARTES está cerrada; el resto de la línea sigue"),
  "n14": ("PARO EN GARIBALDI (LÍNEA B GRIS)", "Solo GARIBALDI está cerrada; el resto de la línea sigue"),
  "n15": ("MANIFESTACIÓN EN ZÓCALO (LÍNEA 2 AZUL)", "Solo ZÓCALO está cerrada; el resto de la línea sigue")}
for n in news:
    if n["id"] in BLOCK_TEXT: n["title"], n["impact"] = BLOCK_TEXT[n["id"]]
json.dump(news, open(f"{out}/noticias.json", "w"), ensure_ascii=False, indent=1)
json.dump(config, open(f"{out}/config.json", "w"), ensure_ascii=False, indent=1)
print("ok", len(stations), "estaciones", len(d["CONNECTIONS"]), "conexiones +", len(COMBIS), "combis", len(levels), "niveles", len(news), "noticias")
