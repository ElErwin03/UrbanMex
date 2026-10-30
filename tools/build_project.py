#!/usr/bin/env python3
"""Genera "My project/UrbanMex.json" (proyecto de GDevelop 5.6) a partir de src/*.js, data/*.json y assets/.
 - Cada módulo de src/ se convierte en una hoja de EVENTOS EXTERNOS ("Mod_<nombre>") con un evento de JavaScript.
 - Cada escena enlaza esas hojas (Link) y ejecuta su controlador cada fotograma.
 - Los objetos (Sprite / Texto / Dibujante de formas) y recursos se declaran aquí; las instancias se crean desde el código.
Uso: python3 tools/build_project.py        (desde la raíz del repo)"""
import json, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.join(ROOT, 'My project')
SRC = os.path.join(ROOT, 'src')
MODULES = ['core', 'data', 'graph', 'rules', 'news', 'ui', 'map', 'phone', 'fx', 'scene-menu', 'scene-tutorial', 'scene-nivel', 'scene-resultado']
FONT = 'PressStart2P-Regular.ttf'

# ------------------------------------------------------------------ recursos
def resources():
    res = []
    for f in sorted(glob.glob(f'{PROJ}/assets/img/*.png')):
        n = os.path.basename(f)
        # sprites de efectos (fx_*): luces y sombras suaves, se escalan con filtro lineal; el pixel art conserva 'nearest'
        res.append({"alwaysLoaded": False, "file": f"assets/img/{n}", "kind": "image", "metadata": "", "name": n, "smoothed": n.startswith('fx_'), "userAdded": True})
    res.append({"alwaysLoaded": False, "file": f"assets/fonts/{FONT}", "kind": "font", "metadata": "", "name": FONT, "userAdded": True})
    for f in sorted(glob.glob(f'{PROJ}/data/*.json')):
        n = os.path.basename(f)
        res.append({"alwaysLoaded": True, "file": f"data/{n}", "kind": "json", "metadata": "", "name": f"data/{n}", "userAdded": True})
    return res

# ------------------------------------------------------------------ objetos
def sprite(name, anims, loop=True, tbf=0.25):
    animations = []
    for aname, images in anims:
        animations.append({"name": aname, "useMultipleDirections": False, "directions": [{
            "looping": loop, "timeBetweenFrames": tbf,
            "sprites": [{"hasCustomCollisionMask": False, "image": im, "points": [],
                         "originPoint": {"name": "origine", "x": 0, "y": 0},
                         "centerPoint": {"automatic": True, "name": "centre", "x": 0, "y": 0}, "customCollisionMask": []} for im in images]}]})
    return {"assetStoreId": "", "name": name, "tags": "", "type": "Sprite", "variables": [], "effects": [], "behaviors": [],
            "updateIfNotVisible": False, "animations": animations}

def text(name, outline=False):
    return {"assetStoreId": "", "name": name, "tags": "", "type": "TextObject::Text", "variables": [], "effects": [], "behaviors": [],
            "content": {"bold": False, "italic": False, "underlined": False, "smoothed": False, "text": "", "font": FONT, "characterSize": 8,
                        "color": "255;255;255", "textAlignment": "left", "verticalTextAlignment": "top", "lineHeight": 0,
                        "isOutlineEnabled": outline, "outlineColor": "10;8;20", "outlineThickness": 3,
                        "isShadowEnabled": False, "shadowColor": "0;0;0", "shadowOpacity": 127, "shadowDistance": 4, "shadowAngle": 90, "shadowBlurRadius": 2}}

def painter(name):
    return {"assetStoreId": "", "name": name, "tags": "", "type": "PrimitiveDrawing::Drawer", "variables": [], "effects": [], "behaviors": [],
            "fillColor": "255;255;255", "outlineColor": "255;255;255", "fillOpacity": 255, "outlineOpacity": 255, "outlineSize": 0,
            "absoluteCoordinates": True, "clearBetweenFrames": False, "antialiasing": "none"}

FX_ANIMS = ['glow', 'soft', 'fog', 'vignette', 'spark', 'shadow', 'beam', 'haze_t', 'haze_b', 'solid']   # = sprites fx_*.png (src/fx.js)
ICONS = ['moneda', 'rayo', 'reloj', 'tienda', 'meta', 'casa', 'bloqueo', 'alerta', 'noticia', 'mapa', 'saldo', 'ajustes', 'persona', 'celular', 'lineas', 'combi']
O = {
  'Texto': text('Texto'), 'TextoMapa': text('TextoMapa', outline=True), 'UIBase': painter('UIBase'), 'UIModal': painter('UIModal'), 'Mapa': painter('Mapa'),
  'Icono': sprite('Icono', [(i, [f'icono_{i}.png']) for i in ICONS]),
  'Estacion': sprite('Estacion', [(a, [f'estacion_{a}.png']) for a in ['normal', 'tienda', 'meta', 'bloqueada', 'inicio']]),
  'Jugador': sprite('Jugador', [('a0', ['jugador_0.png']), ('a1', ['jugador_1.png'])]),
  'Edificio': sprite('Edificio', [(f'e{i}', [f'edificio_{i}.png']) for i in range(4)]),
  'EdificioIso': sprite('EdificioIso', [(f'b{i}', [f'iso_edificio_{i}.png']) for i in range(6)] + [('parque', ['iso_parque.png'])]),
  'Tren': sprite('Tren', [('tren', ['tren.png'])]),
  'Fx': sprite('Fx', [(a, [f'fx_{a}.png']) for a in FX_ANIMS]),
}
UI_OBJS = ['Texto', 'Icono', 'UIBase', 'UIModal']
SCENES = {
  'Menu': (UI_OBJS + ['Edificio', 'Tren', 'Fx'], 'scene-menu', 'menu'),
  'Tutorial': (UI_OBJS + ['Fx'], 'scene-tutorial', 'tutorial'),
  'Nivel': (UI_OBJS + ['TextoMapa', 'Mapa', 'Estacion', 'Jugador', 'EdificioIso', 'Fx'], 'scene-nivel', 'nivel'),
  'Resultado': (UI_OBJS + ['Fx'], 'scene-resultado', 'resultado'),
}

# ------------------------------------------------------------------ eventos
def js_event(code, folded=False):
    return {"type": "BuiltinCommonInstructions::JsCode", "inlineCode": code.rstrip('\n').split('\n'), "parameterObjects": "",
            "useStrict": True, "eventsSheetExpanded": False, "disabled": False, "folded": folded}
def comment(txt):
    return {"type": "BuiltinCommonInstructions::Comment", "comment": txt, "comment2": "", "disabled": False, "folded": False,
            "color": {"b": 109, "g": 230, "r": 255, "textB": 0, "textG": 0, "textR": 0}}
def link(target):
    return {"type": "BuiltinCommonInstructions::Link", "include": {"includeConfig": 0}, "target": target, "disabled": False, "folded": False}

def read(mod): return open(f'{SRC}/{mod}.js', encoding='utf8').read()

def layer(name):
    return {"ambientLightColorB": 200, "ambientLightColorG": 200, "ambientLightColorR": 200, "camera2DPlaneMaxDrawingDistance": 5000,
            "camera3DFarPlaneDistance": 10000, "camera3DFieldOfView": 45, "camera3DNearPlaneDistance": 3, "cameraType": "",
            "followBaseLayerCamera": False, "isLightingLayer": False, "isLocked": False, "name": name, "renderingType": "", "visibility": True,
            "cameras": [{"defaultSize": True, "defaultViewport": True, "height": 0, "viewportBottom": 1, "viewportLeft": 0, "viewportRight": 1, "viewportTop": 0, "width": 0}],
            "effects": []}

def scene(name, objs, own_mod, fn):
    events = [comment('Los modulos del juego viven en las hojas de eventos externos "Mod_*" (codigo fuente en la carpeta src/ del repo). '
                      'Se enlazan aqui; despues el controlador de esta escena corre cada fotograma.')]
    events += [link('Mod_' + m) for m in MODULES]
    events.append(js_event(f'gdjs.UrbanMex.Scenes.{fn}(runtimeScene);'))
    return {"b": 28, "disableInputWhenNotFocused": True, "mangledName": name, "name": name, "r": 14, "stopSoundsOnStartup": True, "title": "", "v": 12,
            "renderer3DWorldScale": 100, "standardSortMethod": True,
            "uiSettings": {"grid": False, "gridType": "rectangular", "gridWidth": 32, "gridHeight": 32, "gridDepth": 32, "gridOffsetX": 0, "gridOffsetY": 0,
                           "gridOffsetZ": 0, "gridColor": 10401023, "gridAlpha": 0.8, "snap": False, "zoomFactor": 0.5, "windowMask": False,
                           "selectedLayer": "", "gameEditorMode": "instances-editor"},
            "objectsGroups": [], "variables": [], "instances": [], "objects": [O[o] for o in objs],
            "objectsFolderStructure": {"folderName": "__ROOT", "children": [{"objectName": o} for o in objs]},
            "events": events, "layers": [layer(''), layer('FX'), layer('UI')], "behaviorsSharedData": []}

def main():
    base = json.load(open(f'{PROJ}/UrbanMex.json', encoding='utf8')) if os.path.exists(f'{PROJ}/UrbanMex.json') else {}
    props = base.get('properties', {})
    props.update({"name": "UrbanMex", "windowWidth": 1280, "windowHeight": 720, "scaleMode": "nearest", "pixelsRounding": True,
                  "antialiasingMode": "none", "orientation": "landscape", "adaptGameResolutionAtRuntime": True, "sizeOnStartupMode": "adaptWidth",
                  "version": "2.0.0", "description": "Supervivencia Urbana - Metro CDMX"})
    proj = {"firstLayout": "Menu", "gdVersion": {"build": 285, "major": 5, "minor": 6, "revision": 0}, "initialGDVersion": "5.6.285",
            "properties": props, "resources": {"resources": resources()}, "objects": [], "objectsFolderStructure": {"folderName": "__ROOT"},
            "objectsGroups": [], "variables": [], "layouts": [scene(n, *v) for n, v in SCENES.items()],
            "externalEvents": [{"associatedLayout": "", "name": 'Mod_' + m, "events": [comment(f'Modulo "{m}" - fuente: src/{m}.js (se regenera con tools/build_project.py).'), js_event(read(m), True)]} for m in MODULES],
            "eventsFunctionsExtensions": [], "externalLayouts": []}
    json.dump(proj, open(f'{PROJ}/UrbanMex.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    print('proyecto escrito:', len(proj['layouts']), 'escenas,', len(proj['externalEvents']), 'modulos,', len(proj['resources']['resources']), 'recursos')

if __name__ == '__main__':
    main()
