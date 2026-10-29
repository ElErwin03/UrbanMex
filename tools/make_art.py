#!/usr/bin/env python3
"""Genera todo el pixel art del juego (PNG con transparencia) en "My project/assets/img".
Se dibuja a resolución nativa pequeña; el motor lo escala con filtro 'nearest' para que se vea nítido.
Para cambiar el estilo edita este archivo y vuelve a ejecutarlo (python3 tools/make_art.py)."""
import os, random
from PIL import Image, ImageDraw
OUT = 'My project/assets/img'; os.makedirs(OUT, exist_ok=True)
K = (18, 14, 32, 255); W = (255, 255, 255, 255); T = (0, 0, 0, 0)
def C(h, a=255): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
OR, OR2, YE, YE2, RD, GR, GR2, BL, BL2, PU, GY, GY2, SK = (C(x) for x in
  ('#ff6b35', '#c0392b', '#f5c542', '#b8860b', '#e74c3c', '#2ecc71', '#1e8449', '#3498db', '#21618c', '#9b59b6', '#9aa0b4', '#5c6178', '#f2c9a0'))
def new(w, h): im = Image.new('RGBA', (w, h), T); return im, ImageDraw.Draw(im)
def save(im, name): im.save(f'{OUT}/{name}.png')

# ---------- iconos 16x16 ----------
def ic_moneda():
    im, d = new(16, 16); d.ellipse([1, 1, 14, 14], fill=YE, outline=YE2); d.ellipse([4, 4, 11, 11], outline=YE2)
    d.rectangle([7, 5, 8, 10], fill=YE2); d.point([(3, 3), (4, 2)], fill=W); return im
def ic_rayo():
    im, d = new(16, 16); d.polygon([(9, 0), (3, 9), (7, 9), (5, 15), (13, 6), (9, 6), (11, 0)], fill=YE, outline=OR2); return im
def ic_reloj():
    im, d = new(16, 16); d.ellipse([1, 1, 14, 14], fill=W, outline=K); d.line([8, 8, 8, 4], fill=K); d.line([8, 8, 11, 9], fill=RD); return im
def ic_tienda():   # lata de energizante
    im, d = new(16, 16); d.rectangle([4, 1, 11, 14], fill=K, outline=GY2)
    for x in (5, 7, 9): d.rectangle([x, 3, x, 12], fill=GR)
    d.rectangle([4, 1, 11, 2], fill=GY); return im
def ic_meta():
    im, d = new(16, 16); d.line([3, 1, 3, 15], fill=GY2)
    for y in range(2, 8):
        for x in range(4, 13): d.point((x, y), fill=W if ((x // 2 + y // 2) % 2) else K)
    return im
def ic_casa():
    im, d = new(16, 16); d.polygon([(8, 1), (1, 8), (15, 8)], fill=RD, outline=K); d.rectangle([3, 8, 12, 14], fill=SK, outline=K)
    d.rectangle([7, 10, 9, 14], fill=OR2); return im
def ic_bloqueo():  # cono
    im, d = new(16, 16); d.polygon([(8, 1), (4, 13), (12, 13)], fill=OR, outline=K); d.rectangle([5, 7, 11, 8], fill=W)
    d.rectangle([2, 13, 13, 15], fill=K); return im
def ic_alerta():
    im, d = new(16, 16); d.polygon([(8, 1), (1, 14), (15, 14)], fill=YE, outline=K); d.rectangle([7, 5, 8, 10], fill=K); d.rectangle([7, 12, 8, 12], fill=K); return im
def ic_noticia():
    im, d = new(16, 16); d.rectangle([2, 2, 13, 13], fill=W, outline=K); d.rectangle([4, 4, 8, 6], fill=K)
    for y in (8, 10, 12): d.line([4, y, 11, y], fill=GY2)
    return im
def ic_mapa():
    im, d = new(16, 16); d.polygon([(1, 3), (5, 2), (10, 4), (15, 2), (15, 13), (10, 15), (5, 13), (1, 14)], fill=(190, 230, 200, 255), outline=K)
    d.line([4, 11, 7, 7, 10, 9, 12, 5], fill=RD); d.point((12, 5), fill=K); return im
def ic_saldo():
    return ic_moneda()
def ic_ajustes():
    im, d = new(16, 16)
    for a in [(7, 0), (7, 13), (0, 7), (13, 7), (2, 2), (11, 2), (2, 11), (11, 11)]: d.rectangle([a[0], a[1], a[0] + 2, a[1] + 2], fill=GY)
    d.ellipse([3, 3, 12, 12], fill=GY, outline=K); d.ellipse([6, 6, 9, 9], fill=K); return im
def ic_persona():
    im, d = new(16, 16); d.ellipse([4, 1, 11, 8], fill=SK, outline=K); d.rectangle([3, 9, 12, 15], fill=OR, outline=K); return im
def ic_celular():
    im, d = new(16, 16); d.rectangle([4, 0, 11, 15], fill=K, outline=GY); d.rectangle([5, 2, 10, 12], fill=(70, 130, 210, 255))
    d.rectangle([6, 3, 9, 4], fill=W); d.line([6, 6, 9, 6], fill=(190, 215, 250, 255)); d.line([6, 8, 9, 8], fill=(190, 215, 250, 255)); d.point((7, 14), fill=GY); d.point((8, 14), fill=GY); return im
def ic_lineas():   # las cinco líneas del Metro: rosa, azul, verde, amarilla y gris
    im, d = new(16, 16)
    for y, c in zip((1, 4, 7, 10, 13), ('#E91E63', '#2196F3', '#8BC34A', '#FFEB3B', '#9E9E9E')):
        d.rectangle([1, y, 14, y + 1], fill=C(c)); d.point((3, y), fill=W); d.point((8, y), fill=W); d.point((12, y), fill=W)
    return im
def ic_combi():    # microbús
    im, d = new(16, 16); d.rectangle([1, 3, 14, 12], fill=OR, outline=K); d.rectangle([2, 5, 13, 7], fill=(190, 225, 250, 255))
    for x in (5, 9): d.line([x, 5, x, 7], fill=OR)
    d.rectangle([1, 9, 14, 9], fill=YE); d.ellipse([2, 11, 5, 14], fill=K); d.ellipse([10, 11, 13, 14], fill=K); d.point((14, 8), fill=YE); return im
ICONS = {'moneda': ic_moneda, 'rayo': ic_rayo, 'reloj': ic_reloj, 'tienda': ic_tienda, 'meta': ic_meta, 'casa': ic_casa,
         'bloqueo': ic_bloqueo, 'alerta': ic_alerta, 'noticia': ic_noticia, 'mapa': ic_mapa, 'saldo': ic_saldo, 'ajustes': ic_ajustes, 'persona': ic_persona, 'celular': ic_celular, 'lineas': ic_lineas, 'combi': ic_combi}
for n, f in ICONS.items(): save(f(), f'icono_{n}')

# ---------- estaciones 16x16 (blancas para teñirlas con el color de su línea) ----------
def est_base(d):
    d.ellipse([1, 1, 14, 14], fill=W, outline=K); d.ellipse([4, 4, 11, 11], fill=(235, 235, 245, 255), outline=GY)
def est(name, extra=None):
    im, d = new(16, 16); est_base(d)
    if extra: extra(d)
    save(im, f'estacion_{name}')
est('normal'); est('tienda', lambda d: d.rectangle([6, 5, 9, 10], fill=K)); est('meta', lambda d: (d.line([6, 4, 6, 11], fill=K), d.rectangle([7, 4, 10, 6], fill=RD)))
est('bloqueada', lambda d: (d.line([4, 4, 11, 11], fill=PU), d.line([4, 11, 11, 4], fill=PU), d.line([5, 4, 12, 11], fill=PU)))
est('inicio', lambda d: d.polygon([(8, 4), (4, 8), (12, 8)], fill=OR2))

# ---------- jugador 12x18, dos cuadros (respiración) ----------
def jugador(f):
    im, d = new(12, 18); b = f
    d.rectangle([3, 0 + b, 8, 4 + b], fill=SK, outline=K); d.rectangle([3, 0 + b, 8, 1 + b], fill=(60, 40, 30, 255))   # cabeza + pelo
    d.rectangle([2, 5 + b, 9, 11 + b], fill=OR, outline=K); d.rectangle([0, 6 + b, 1, 12 + b], fill=BL2)               # torso + mochila
    d.rectangle([3, 12 + b, 4, 16], fill=BL2, outline=K); d.rectangle([7, 12 + b, 8, 16], fill=BL2, outline=K)        # piernas
    d.point([(4, 2 + b), (7, 2 + b)], fill=K); return im
save(jugador(0), 'jugador_0'); save(jugador(1), 'jugador_1')

# ---------- edificios 24x32 (4 variantes) ----------
def edificio(seed, col):
    rnd = random.Random(seed); im, d = new(24, 32)
    d.rectangle([1, 4, 22, 31], fill=col, outline=K); d.rectangle([1, 4, 22, 6], fill=tuple(min(255, c + 25) for c in col[:3]) + (255,))
    for y in range(9, 29, 6):
        for x in range(4, 20, 6): d.rectangle([x, y, x + 2, y + 3], fill=YE if rnd.random() > 0.55 else (35, 38, 70, 255))
    if seed % 2: d.rectangle([10, 0, 11, 4], fill=GY2)   # antena
    return im
for i, col in enumerate([C('#3a3a5e'), C('#4a4a6e'), C('#5a5a7e'), C('#443355')]): save(edificio(i + 1, col), f'edificio_{i}')

# ---------- tren del menú 96x24 ----------
def tren():
    im, d = new(96, 24)
    for i in range(3):
        x0 = i * 32; d.rectangle([x0, 2, x0 + 30, 19], fill=OR, outline=K); d.rectangle([x0, 14, x0 + 30, 16], fill=OR2)
        for x in (3, 12, 21): d.rectangle([x0 + x, 5, x0 + x + 6, 11], fill=(255, 245, 190, 255), outline=K)
        d.ellipse([x0 + 4, 19, x0 + 9, 23], fill=K); d.ellipse([x0 + 21, 19, x0 + 26, 23], fill=K)
    return im
save(tren(), 'tren')

# ---------- logo del menú 16x16 (ícono metro) ----------
im, d = new(16, 16); d.ellipse([0, 0, 15, 15], fill=OR, outline=K); d.rectangle([4, 4, 11, 9], fill=W, outline=K); d.rectangle([5, 10, 6, 11], fill=K); d.rectangle([9, 10, 10, 11], fill=K)
save(im, 'logo_metro')
# ---------- ciudad isométrica 2.5D (EdificioIso): 48 px de ancho = 1 casilla del mapa; el rombo base mide 44x22 ----------
def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)
def iso_edificio(hgt, base, seed, antena=False):
    rnd = random.Random(seed); Wd, Ht = 48, hgt + 24 + (7 if antena else 0)
    im, d = new(Wd, Ht); by = Ht - 12                        # centro del rombo base
    L, R, B, Tp = (2, by), (45, by), (24, by + 11), (24, by - 11)
    up = lambda p: (p[0], p[1] - hgt)
    left = shade(base, 1.0); right = shade(base, 0.68); top = shade(base, 1.35)
    d.polygon([L, B, up(B), up(L)], fill=left); d.polygon([B, R, up(R), up(B)], fill=right)
    d.polygon([up(Tp), up(R), up(B), up(L)], fill=top)
    for a, b in [(L, B), (B, R), (L, up(L)), (B, up(B)), (R, up(R)), (up(L), up(Tp)), (up(Tp), up(R)), (up(R), up(B)), (up(B), up(L))]: d.line([a, b], fill=K)
    for x in range(6, 21, 5):                                 # ventanas cara izquierda (siguen la pendiente de 1:2)
        for r in range(5, hgt - 4, 7):
            y = by - hgt + (x - 2) // 2 + r; d.rectangle([x, y, x + 2, y + 3], fill=YE if rnd.random() > 0.6 else (35, 38, 70, 255))
    for x in range(28, 43, 5):                                # cara derecha
        for r in range(5, hgt - 4, 7):
            y = by - hgt + 11 - (x - 24) // 2 + r; d.rectangle([x, y, x + 2, y + 3], fill=(255, 214, 120, 255) if rnd.random() > 0.7 else (28, 30, 56, 255))
    if antena: d.rectangle([23, 0, 24, 8 + 2], fill=GY2); d.point((23, 0), fill=RD)
    return im
for i, (h, col, an) in enumerate([(16, C('#8a5a52'), False), (28, C('#4f6a9a'), False), (40, C('#3f7a88'), True),
                                  (56, C('#6a5a9a'), True), (22, C('#9a8a62'), False), (34, C('#6a6f8c'), True)]):
    save(iso_edificio(h, col, 11 + i, an), f'iso_edificio_{i}')

def iso_parque():          # plaza con árboles
    im, d = new(48, 36); by = 24
    d.polygon([(2, by), (24, by - 11), (45, by), (24, by + 11)], fill=C('#2f7a45'), outline=K)
    d.polygon([(2, by), (24, by + 11), (24, by + 12), (2, by + 1)], fill=C('#1b4f2c')); d.polygon([(24, by + 11), (45, by), (45, by + 1), (24, by + 12)], fill=C('#14401f'))
    for tx, ty in [(14, 22), (30, 20), (24, 28), (36, 26)]:
        d.rectangle([tx, ty, tx + 1, ty + 5], fill=C('#5c3b22')); d.ellipse([tx - 4, ty - 8, tx + 5, ty + 1], fill=C('#3fa860'), outline=C('#1e6e3a'))
    return im
save(iso_parque(), 'iso_parque')

print('ok', len(os.listdir(OUT)), 'imágenes en', OUT)
