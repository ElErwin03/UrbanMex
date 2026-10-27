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

EMOJI = re.compile('[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200D]+')
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
  "news": {"firstDelaySec": 2, "intervalSec": [10, 18], "chance": 0.5}
}

# ---- estaciones --------------------------------------------------------
LINES = {
  "1": {"name": "Línea 1", "color": "#E91E63"}, "2": {"name": "Línea 2", "color": "#2196F3"},
  "3": {"name": "Línea 3", "color": "#8BC34A"}, "5": {"name": "Línea 5", "color": "#FFEB3B"},
  "B": {"name": "Línea B", "color": "#9E9E9E"}}
FIX_POS = {"Guerrero LB": (9, 6), "Valle Gómez": (16, 3)}   # estaban encimadas con otra estación
stations = []
for name, s in d["STATIONS"].items():
    x, y = FIX_POS.get(name, (s["x"], s["y"]))
    stations.append({"id": name, "x": x, "y": y, "line": str(s["line"]), "shop": bool(s["shop"])})
json.dump({"lines": LINES, "stations": stations}, open(f"{out}/estaciones.json", "w"), ensure_ascii=False, indent=1)
json.dump(d["CONNECTIONS"], open(f"{out}/conexiones.json", "w"), ensure_ascii=False)

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
json.dump(news, open(f"{out}/noticias.json", "w"), ensure_ascii=False, indent=1)
json.dump(config, open(f"{out}/config.json", "w"), ensure_ascii=False, indent=1)
print("ok", len(stations), "estaciones", len(d["CONNECTIONS"]), "conexiones", len(levels), "niveles", len(news), "noticias")
