#!/usr/bin/env python3
"""Vista previa sin GDevelop, paso 2/2: convierte el volcado de tools/dump_scene.js en un PNG de 1280x720.

  python3 tools/render_preview.py <volcado.json> <carpeta-del-repo> <salida.png> [--crop x0,y0,x1,y1] [--zoom N]

Respeta capas (en orden), zOrder y la cámara de la capa base. Dibuja sprites (con tinte, opacidad, escala X/Y y modo de mezcla normal,
aditivo, multiplicar o pantalla; 'nearest' o suavizado según el recurso), textos con la fuente del juego y los comandos de los objetos
Dibujante (con transparencia).
Es una APROXIMACIÓN del juego real: no reproduce filtros de capa de GDevelop ni el suavizado exacto de la GPU."""
import json, os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops

W, H = 1280, 720
BG = (14, 12, 28)                                    # color de fondo de las escenas (r/v/b del proyecto)


def rgb(c):
    return tuple(int(v) for v in c.split(';'))


def a8(v):
    """Opacidad 0..255 del juego (puede venir con decimales) -> entero."""
    return max(0, min(255, int(round(v))))


def blend_paste(img, rgb, a, px, py, mode):
    """Compone un sprite (rgb: Image RGB, a: Image L) sobre img en (px, py) con el modo de mezcla de PIXI (0 normal, 1 aditivo, 2 multiplicar, 3 pantalla)."""
    if mode == 0:
        img.paste(rgb, (px, py), a); return
    x0, y0, x1, y1 = max(px, 0), max(py, 0), min(px + rgb.width, img.width), min(py + rgb.height, img.height)
    if x1 <= x0 or y1 <= y0:
        return
    box = (x0 - px, y0 - py, x1 - px, y1 - py)
    src = np.asarray(rgb.crop(box), dtype=np.float32); al = np.asarray(a.crop(box), dtype=np.float32)[..., None] / 255
    dst = np.asarray(img.crop((x0, y0, x1, y1)), dtype=np.float32)
    if mode == 1:
        out = dst + src * al
    elif mode == 2:
        out = dst * (1 - al) + dst * src / 255 * al
    else:
        out = dst * (1 - al) + (255 - (255 - dst) * (255 - src) / 255) * al
    img.paste(Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGB'), (x0, y0))


def load_image(cache, proj, f):
    if f not in cache:
        cache[f] = Image.open(os.path.join(proj, 'My project', f)).convert('RGBA')
    return cache[f]


def render(dump, repo, out, crop=None, zoom=1):
    d = json.load(open(dump))
    proj = os.path.abspath(repo)
    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img, 'RGBA')
    cache, fonts = {}, {}
    font_file = os.path.join(proj, 'My project', 'assets', 'fonts', 'PressStart2P-Regular.ttf')

    def font(size):
        size = max(4, int(round(size)))
        if size not in fonts:
            fonts[size] = ImageFont.truetype(font_file, size)
        return fonts[size]

    for lname in d['layers']:
        cam = d['cams'].get(lname, {'x': 640, 'y': 360, 'zoom': 1})
        z = cam['zoom']

        def T(x, y):
            return ((x - cam['x']) * z + 640, (y - cam['y']) * z + 360)

        objs = sorted([o for o in d['objects'] if o['layer'] == lname], key=lambda o: (o['z'], o['idx']))
        for o in objs:
            if o['type'] == 'Sprite':
                info = d['images'].get(o['name'] + '/' + o['anim'])
                if not info or a8(o['opacity']) <= 0:
                    continue
                src = load_image(cache, proj, info['file'])
                scx, scy = o.get('sx', o['scale']) * z, o.get('sy', o['scale']) * z
                w, h = max(1, int(round(src.width * scx))), max(1, int(round(src.height * scy)))
                if max(scx, scy) > 6:                       # fondos planos enormes: no hace falta remuestrear (evita imágenes gigantes)
                    w, h = min(w, 4096), min(h, 4096)
                im = src.resize((w, h), Image.BILINEAR if info['smoothed'] else Image.NEAREST)
                tint = rgb(o['color'])
                r, g, b, a = im.split()
                if tint != (255, 255, 255):
                    r, g, b = [ch.point(lambda v, t=t: v * t // 255) for ch, t in zip((r, g, b), tint)]
                a = a.point(lambda v, k=a8(o['opacity']): v * k // 255)
                px, py = T(o['x'], o['y'])
                blend_paste(img, Image.merge('RGB', (r, g, b)), a, int(round(px)), int(round(py)), o.get('blend', 0))
            elif o['type'] == 'TextObject::Text':
                if not o['text']:
                    continue
                px, py = T(o['x'], o['y'])
                f, col = font(o['size'] * z), rgb(o['color'])
                if o['outline']:
                    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1), (0, 2), (0, -2), (2, 0), (-2, 0)):
                        draw.text((px + dx, py + dy), o['text'], font=f, fill=(10, 8, 20, a8(o['opacity'])))
                draw.text((px, py), o['text'], font=f, fill=col + (a8(o['opacity']),))
            else:                                           # objeto Dibujante
                path = None
                for op in o['ops']:
                    k, a = op['k'], op['a']
                    fill = rgb(op['fill']) + (a8(op['fo']),)
                    if k == 'drawRectangle':
                        (x1, y1), (x2, y2) = T(a[0], a[1]), T(a[2], a[3])
                        draw.rectangle([min(x1, x2), min(y1, y2), max(x1, x2) - 1, max(y1, y2) - 1], fill=fill)
                    elif k == 'drawEllipse':
                        cx, cy = T(a[0], a[1])
                        draw.ellipse([cx - a[2] * z / 2, cy - a[3] * z / 2, cx + a[2] * z / 2, cy + a[3] * z / 2], fill=fill)
                    elif k == 'drawCircle':
                        cx, cy = T(a[0], a[1])
                        draw.ellipse([cx - a[2] * z, cy - a[2] * z, cx + a[2] * z, cy + a[2] * z], fill=fill)
                    elif k == 'drawLineV2':
                        (x1, y1), (x2, y2) = T(a[0], a[1]), T(a[2], a[3])
                        L = math.hypot(x2 - x1, y2 - y1) or 1
                        nx, ny = -(y2 - y1) / L * a[4] * z / 2, (x2 - x1) / L * a[4] * z / 2
                        draw.polygon([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)], fill=rgb(op['oc']) + (a8(op['oo']),))
                    elif k == 'beginFillPath':
                        path = ([T(a[0], a[1])], fill)
                    elif k == 'drawPathLineTo' and path:
                        path[0].append(T(a[0], a[1]))
                    elif k == 'endFillPath' and path:
                        if len(path[0]) > 2:
                            draw.polygon(path[0], fill=path[1])
                        path = None
    if crop:
        img = img.crop(crop)
    if zoom != 1:
        img = img.resize((img.width * zoom, img.height * zoom), Image.NEAREST)
    img.save(out)
    print('vista previa ->', out, img.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 3:
        sys.exit(__doc__)
    crop = tuple(int(v) for v in a[a.index('--crop') + 1].split(',')) if '--crop' in a else None
    zoom = int(a[a.index('--zoom') + 1]) if '--zoom' in a else 1
    render(a[0], a[1], a[2], crop, zoom)
