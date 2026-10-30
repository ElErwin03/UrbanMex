#!/usr/bin/env python3
"""Genera todo el arte del juego (PNG con transparencia) en "My project/assets/img".
Sprites del juego: se dibujan a resolución nativa pequeña (pixel art) con acabado "HD-2D" (luz, material, oclusión ambiental) y el motor
los escala con filtro 'nearest' para que se vean nítidos. Sprites de efectos (fx_*): suaves; el proyecto los marca con suavizado.
Requiere Pillow y numpy. Para cambiar el estilo edita este archivo y vuelve a ejecutarlo (python3 tools/make_art.py)."""
import os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
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

# ===========================================================================================================================
# Acabado "HD-2D" de los sprites del mapa y del menú. Mismas siluetas, tamaños y ventanas encendidas que antes (misma semilla,
# mismas llamadas al azar); lo que cambia es el MATERIAL: grano, degradados con oclusión ambiental junto al suelo, luz cálida desde
# la izquierda y ambiente frío en sombra, ventanas con brillo, bordes con luz rasante y aristas suavizadas en lugar de líneas negras.
# Los iconos de la interfaz (arriba) no se tocan.
# ===========================================================================================================================
def arr(im): return np.asarray(im.convert('RGBA'), dtype=np.float32).copy()
def to_im(a): return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), 'RGBA')
def lab_poly(size, polys):                       # mapa de etiquetas: polys = [(valor, puntos)], pintadas en orden
    m = Image.new('L', size, 0); d = ImageDraw.Draw(m)
    for v, p in polys: d.polygon(p, fill=v)
    return np.asarray(m)
def erode(m): p = np.pad(m, 1); return p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
def dilate(m): p = np.pad(m, 1); return p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
def lowfreq(w, h, rng, cell=6):                  # ruido suave de baja frecuencia en [0, 1]
    g = Image.fromarray((rng.random((h // cell + 3, w // cell + 3)) * 255).astype(np.uint8))
    return np.asarray(g.resize((w + 2 * cell, h + 2 * cell), Image.BICUBIC), dtype=np.float32)[:h, :w] / 255
def grade(rgb, con=1.10, sat=1.10):              # contraste y saturación equilibrados
    lum = (rgb * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
    out = lum + (rgb - lum) * sat
    return (((out / 255) - 0.5) * con + 0.5) * 255
def put(col, mask, c): col[mask] = np.array(c, np.float32)

# ---------- estaciones 16x16 (blancas para teñirlas con el color de su línea): botón con relieve, centro hundido ----------
def estacion(name, extra=None):
    S = 16
    def disc(box):
        m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).ellipse(box, fill=255); return np.asarray(m) > 0
    outer, inner = disc([1, 1, 14, 14]), disc([4, 4, 11, 11])
    Y, X = np.mgrid[0:S, 0:S].astype(np.float32); ux, uy = (X - 7.5) / 7, (Y - 7.5) / 7
    z = np.sqrt(1 - np.clip(ux * ux + uy * uy, 0, 1)); br = np.clip((-0.5 * ux - 0.7 * uy + 0.5 * z) / 0.95, 0, 1)
    out = np.zeros((S, S, 4), np.float32)
    for m, s in ((outer, 255 * (0.64 + 0.36 * br)), (inner, 255 * (0.98 - 0.28 * br))):    # aro abombado / centro hundido (sombra arriba-izquierda)
        for k in range(3): out[m, k] = s[m]
        out[m, 3] = 255
    out[outer & ~erode(outer)] = K; out[inner & ~erode(inner)] = (150, 156, 176, 255)
    im = to_im(out); d = ImageDraw.Draw(im)
    if extra: extra(d)
    save(im, f'estacion_{name}')
estacion('normal'); estacion('tienda', lambda d: d.rectangle([6, 5, 9, 10], fill=K)); estacion('meta', lambda d: (d.line([6, 4, 6, 11], fill=K), d.rectangle([7, 4, 10, 6], fill=RD)))
estacion('bloqueada', lambda d: (d.line([4, 4, 11, 11], fill=PU), d.line([4, 11, 11, 4], fill=PU), d.line([5, 4, 12, 11], fill=PU)))
estacion('inicio', lambda d: d.polygon([(8, 4), (4, 8), (12, 8)], fill=OR2))

# ---------- jugador 12x18, dos cuadros (respiración): misma silueta, con volumen y luz cálida a la izquierda ----------
HAIR = (60, 40, 30, 255)
def jugador(f):
    im, d = new(12, 18); b = f
    d.rectangle([3, 0 + b, 8, 4 + b], fill=SK, outline=K); d.rectangle([3, 0 + b, 8, 1 + b], fill=HAIR)   # cabeza + pelo
    d.rectangle([2, 5 + b, 9, 11 + b], fill=OR, outline=K); d.rectangle([0, 6 + b, 1, 12 + b], fill=BL2)    # torso + mochila
    d.rectangle([3, 12 + b, 4, 16], fill=BL2, outline=K); d.rectangle([7, 12 + b, 8, 16], fill=BL2, outline=K)   # piernas
    d.point([(4, 2 + b), (7, 2 + b)], fill=K)
    d.point([(4, 3 + b)], fill=(250, 220, 184, 255)); d.point([(5, 3 + b), (6, 3 + b)], fill=(230, 180, 140, 255)); d.point([(7, 3 + b)], fill=(204, 150, 112, 255)); d.point([(5, 2 + b)], fill=(248, 214, 176, 255))   # cara
    d.point([(4, 1 + b)], fill=(98, 70, 52, 255)); d.point([(6, 0 + b)], fill=(82, 58, 44, 255)); d.point([(8, 1 + b)], fill=(36, 24, 20, 255))                                                              # pelo
    d.line([3, 6 + b, 3, 10 + b], fill=(255, 142, 90, 255)); d.line([8, 6 + b, 8, 10 + b], fill=(190, 64, 40, 255)); d.line([4, 10 + b, 7, 10 + b], fill=(212, 84, 44, 255)); d.point([(4, 6 + b)], fill=(255, 170, 120, 255))   # torso
    d.line([0, 7 + b, 0, 12 + b], fill=(58, 128, 176, 255)); d.line([1, 7 + b, 1, 12 + b], fill=(24, 72, 108, 255)); d.point([(0, 6 + b)], fill=(98, 170, 216, 255))                                                # mochila
    d.point([(3, 13 + b), (7, 13 + b)], fill=(58, 50, 94, 255))                                                                                                                                         # piernas
    return im
save(jugador(0), 'jugador_0'); save(jugador(1), 'jugador_1')

# ---------- edificios 24x32 del menú (4 variantes): fachada con degradado, juntas de piso y ventanas con brillo ----------
LIT_F = [(255, 238, 154), (250, 214, 100), (245, 190, 76), (228, 160, 56)]
DARK_F = [(62, 74, 122), (44, 52, 94), (33, 37, 72), (26, 29, 58)]
def edificio(seed, base):
    rnd = random.Random(seed); rng = np.random.default_rng(seed * 101 + 3)
    Wd, Ht = 24, 32
    solid = np.zeros((Ht, Wd), bool); solid[4:32, 1:23] = True
    Y, X = np.mgrid[0:Ht, 0:Wd].astype(np.float32)
    v = np.clip((Y - 4) / 27, 0, 1)
    c = np.broadcast_to(np.array(base[:3], np.float32), (Ht, Wd, 3)).copy()
    c *= (0.82 + 0.32 * v)[..., None]                                          # el resplandor de la ciudad sube desde abajo
    c *= np.where((Y - 4) % 6 == 5, 0.88, 1.0)[..., None]                      # juntas de piso
    c *= (1 + 0.05 * (rng.random((Ht, Wd)) - 0.5) * 2)[..., None]
    c *= (0.95 + 0.10 * lowfreq(Wd, Ht, rng, 4))[..., None]
    c[(Y >= 4) & (Y <= 6)] *= 1.18                                             # cornisa
    c[(X >= 2) & (X <= 3)] *= 1.14; c[X >= 20] *= 0.82                         # luz desde la izquierda
    emit = np.zeros((Ht, Wd), bool)
    for y in range(9, 29, 6):
        for x in range(4, 20, 6):
            lit = rnd.random() > 0.55
            for i, rc in enumerate(LIT_F if lit else DARK_F):
                c[y + i, x:x + 3] = rc
                if lit: emit[y + i, x:x + 3] = True
            if not lit and rng.random() < 0.4: c[y, x] = (126, 146, 200)
    sp = dilate(emit) & ~emit & solid
    c[sp] = c[sp] * 0.84 + np.array([255, 196, 104], np.float32) * 0.16       # luz que se derrama de las ventanas
    out = np.zeros((Ht, Wd, 4), np.float32); out[..., :3] = grade(c, 1.08, 1.10); out[..., 3] = np.where(solid, 255, 0)
    out[solid & ~erode(solid)] = K
    if seed % 2: out[0:5, 10] = (150, 156, 180, 255); out[0:5, 11] = (92, 97, 120, 255)   # antena
    return to_im(out)
for i, col in enumerate([C('#3a3a5e'), C('#4a4a6e'), C('#5a5a7e'), C('#443355')]): save(edificio(i + 1, col), f'edificio_{i}')

# ---------- tren del menú 96x24: carrocería con reflejo, ventanas encendidas que alumbran la lata, ruedas con cubo ----------
def tren():
    im, d = new(96, 24)
    for i in range(3):
        x0 = i * 32; d.rectangle([x0, 2, x0 + 30, 19], fill=OR, outline=K); d.rectangle([x0, 14, x0 + 30, 16], fill=OR2)
        for x in (3, 12, 21): d.rectangle([x0 + x, 5, x0 + x + 6, 11], fill=(255, 245, 190, 255), outline=K)
        d.ellipse([x0 + 4, 19, x0 + 9, 23], fill=K); d.ellipse([x0 + 21, 19, x0 + 26, 23], fill=K)
    a = np.asarray(im).astype(np.int32); o = arr(im)
    isOR = (a == np.array(OR)).all(-1); isOR2 = (a == np.array(OR2)).all(-1); isWIN = (a == np.array((255, 245, 190, 255))).all(-1)
    Y, X = np.mgrid[0:24, 0:96]
    t = np.clip((Y - 3) / 10, 0, 1)[..., None]
    grad = np.array([255, 126, 68], np.float32) * (1 - t) + np.array([240, 86, 42], np.float32) * t
    o[isOR, :3] = grad[isOR]                                                                                         # degradado de la carrocería
    o[isOR & (Y >= 17)] = (200, 78, 44, 255)                                                                         # faldón en sombra
    o[isOR & (Y == 3)] = (255, 158, 104, 255)                                                                        # reflejo del techo
    for yy, cc in ((14, (226, 88, 56, 255)), (15, (192, 57, 43, 255)), (16, (150, 44, 40, 255))): o[isOR2 & (Y == yy)] = cc   # franja
    for i in range(3):
        x0 = i * 32
        o[isOR & (X == x0 + 1)] *= np.array([1.08, 1.08, 1.08, 1])
        o[isOR & (X == x0 + 29)] *= np.array([0.84, 0.84, 0.84, 1])
        for x in (3, 12, 21):
            for k, rc in enumerate([(255, 252, 222), (255, 240, 176), (255, 226, 144), (255, 210, 112), (240, 188, 94)]): o[6 + k, x0 + x + 1:x0 + x + 6] = rc + (255,)
        o[21, x0 + 6] = (88, 80, 116, 255); o[21, x0 + 7] = (62, 56, 88, 255); o[21, x0 + 25] = (88, 80, 116, 255); o[21, x0 + 24] = (62, 56, 88, 255)   # cubo de la rueda
        for wx in (x0 + 5, x0 + 22):
            for k in range(4): o[19, wx + k] = (46, 40, 68, 255)                                                                                              # borde de la rueda
    glow = np.zeros((24, 96), bool)
    for i in range(3):
        for x in (3, 12, 21): glow[4:13, i * 32 + x - 1:i * 32 + x + 8] = True
    sp = glow & isOR
    o[sp] = o[sp] * 0.86 + np.array([255, 214, 130, 255], np.float32) * 0.14                                         # luz de las ventanas sobre la lata
    return to_im(o)
save(tren(), 'tren')

# ---------- logo del menú 16x16 (ícono metro) ----------
im, d = new(16, 16); d.ellipse([0, 0, 15, 15], fill=OR, outline=K); d.rectangle([4, 4, 11, 9], fill=W, outline=K); d.rectangle([5, 10, 6, 11], fill=K); d.rectangle([9, 10, 10, 11], fill=K)
save(im, 'logo_metro')

# ---------- ciudad isométrica 2.5D (EdificioIso): 48 px de ancho = 1 casilla del mapa; el rombo base mide 44x22 ----------
LIT_L = [(255, 244, 176), (255, 222, 120), (252, 198, 92), (238, 168, 64)]
DARK_L = [(70, 86, 140), (48, 58, 104), (34, 40, 78), (26, 30, 60)]
LIT_R = [(255, 222, 140), (255, 204, 100), (240, 170, 70), (214, 140, 52)]
DARK_R = [(40, 48, 92), (28, 34, 66), (22, 26, 52), (16, 18, 40)]
def iso_edificio(hgt, base, seed, antena=False):
    rnd = random.Random(seed); rng = np.random.default_rng(seed * 7919 + 13)
    Wd, Ht = 48, hgt + 24 + (7 if antena else 0); by = Ht - 12                 # centro del rombo base
    L, R, B, Tp = (2, by), (45, by), (24, by + 11), (24, by - 11)
    up = lambda p: (p[0], p[1] - hgt)
    lab = lab_poly((Wd, Ht), [(1, [L, B, up(B), up(L)]), (2, [B, R, up(R), up(B)]), (3, [up(Tp), up(R), up(B), up(L)])])
    isL, isR, isT = lab == 1, lab == 2, lab == 3; solid = lab > 0; side = isL | isR
    Y, X = np.mgrid[0:Ht, 0:Wd].astype(np.float32)
    yt = np.where(X <= 24, by - hgt + (X - 2) * 0.5, by + 11 - hgt - (X - 24) * (11 / 21))      # borde superior de cada pared
    v = np.clip((Y - yt) / hgt, 0, 1)                                                           # 0 = cornisa, 1 = suelo
    k = np.where(isL, 1.0, np.where(isR, 0.66, 1.30)).astype(np.float32)                        # mismos factores de cara que antes
    tint = np.ones((Ht, Wd, 3), np.float32); tint[isL] = (1.06, 1.0, 0.92); tint[isR] = (0.82, 0.90, 1.12); tint[isT] = (1.04, 1.03, 1.08)   # sol cálido / ambiente frío / cielo
    col = np.array(base[:3], np.float32) * k[..., None] * tint
    col *= np.where(side, (1.10 - 0.36 * v ** 1.2) * (1 - 0.30 * np.clip((v - 0.88) / 0.12, 0, 1)), 1.0)[..., None]   # degradado + oclusión ambiental
    hp = v * hgt; sm = hp % 7                                                                   # juntas de piso
    col *= np.where(side & (hp > 2) & (sm < 1), 0.86, np.where(side & (hp > 2) & (sm < 2), 1.05, 1.0))[..., None]
    col *= (1 + np.where(isT, 0.055, 0.035) * (rng.random((Ht, Wd)) - 0.5) * 2)[..., None]   # grano / grava (sutil: da textura sin ensuciar)
    col *= (0.94 + 0.12 * lowfreq(Wd, Ht, rng))[..., None]                                      # manchas de baja frecuencia
    rim = isT & ~erode(isT); ycen = by - hgt                                                    # pretil: luz rasante delante, sombra detrás
    col[rim & (Y > ycen)] *= 1.22; col[rim & (Y <= ycen)] *= 0.86
    col[isL & (X <= 3)] *= 1.15; col[isR & (X >= 43)] *= 0.84; col[isL & (X >= 22)] *= 1.08; col[isR & (X <= 26)] *= 0.84
    bd = np.zeros((Ht, Wd), bool)                                                               # aristas entre caras: oscurecen (sustituyen las líneas negras)
    for dy, dx in ((0, 1), (1, 0)):
        a = lab[:Ht - dy, :Wd - dx]; b2 = lab[dy:, dx:]; dd = (a != b2) & (a > 0) & (b2 > 0)
        bd[:Ht - dy, :Wd - dx] |= dd; bd[dy:, dx:] |= dd
    col[bd] *= 0.62
    emit = np.zeros((Ht, Wd), bool)
    def win(x, y, rows, lit, spec):
        for i, c in enumerate(rows):
            for j in range(3):
                xx, yy = x + j, y + i
                if 0 <= xx < Wd and 0 <= yy < Ht:
                    col[yy, xx] = c
                    if lit: emit[yy, xx] = True
        if spec: col[y, x] = (132, 152, 205)
    for x in range(6, 21, 5):                                  # ventanas cara izquierda (misma rejilla y mismos sorteos que antes)
        for r in range(5, hgt - 4, 7):
            y = by - hgt + (x - 2) // 2 + r; lit = rnd.random() > 0.6; win(x, y, LIT_L if lit else DARK_L, lit, (not lit) and rng.random() < 0.4)
    for x in range(28, 43, 5):                                 # cara derecha
        for r in range(5, hgt - 4, 7):
            y = by - hgt + 11 - (x - 24) // 2 + r; lit = rnd.random() > 0.7; win(x, y, LIT_R if lit else DARK_R, lit, False)
    sp = dilate(emit) & ~emit & side
    col[sp] = col[sp] * 0.84 + np.array([255, 196, 104], np.float32) * 0.16                    # luz que se derrama de las ventanas
    out = np.zeros((Ht, Wd, 4), np.float32); out[..., :3] = grade(col); out[..., 3] = np.where(solid, 255, 0)
    out[dilate(solid) & ~solid] = K
    if antena:
        out[0:11, 23] = (150, 156, 180, 255); out[0:11, 24] = (92, 97, 120, 255); out[0, 23] = (255, 96, 84, 255)
        for yy, xx in ((0, 22), (0, 25), (1, 22), (1, 25)):
            if out[yy, xx, 3] == 0: out[yy, xx] = (255, 80, 70, 90)                              # halo de la luz roja
    return to_im(out)
for i, (h, col, an) in enumerate([(16, C('#8a5a52'), False), (28, C('#4f6a9a'), False), (40, C('#3f7a88'), True),
                                  (56, C('#6a5a9a'), True), (22, C('#9a8a62'), False), (34, C('#6a6f8c'), True)]):
    save(iso_edificio(h, col, 11 + i, an), f'iso_edificio_{i}')

def iso_parque():          # plaza con árboles: césped con franjas de corte, copas con volumen y sombra suave
    rng = np.random.default_rng(5); Wd, Ht = 48, 36; by = 24
    lab = lab_poly((Wd, Ht), [(1, [(2, by), (24, by - 11), (45, by), (24, by + 11)]), (2, [(2, by), (24, by + 11), (24, by + 12), (2, by + 1)]), (3, [(24, by + 11), (45, by), (45, by + 1), (24, by + 12)])])
    isG, isS1, isS2 = lab == 1, lab == 2, lab == 3
    Y, X = np.mgrid[0:Ht, 0:Wd].astype(np.float32)
    col = np.zeros((Ht, Wd, 3), np.float32)
    diag = (X + Y * 2) / (Wd + Ht * 2)
    g = np.array([47, 122, 69], np.float32) * (1.10 - 0.22 * diag)[..., None] * (0.92 + 0.16 * lowfreq(Wd, Ht, rng, 4))[..., None]
    g *= (1 + 0.10 * (rng.random((Ht, Wd)) - 0.5) * 2)[..., None]
    g *= np.where(((X + 2 * Y) // 6) % 2 == 0, 1.05, 0.96)[..., None]
    col[isG] = g[isG]; col[isG & ~erode(isG)] *= 0.80
    col[isS1] = (27, 79, 44); col[isS2] = (20, 64, 31)
    TREES = [(14, 22), (30, 20), (24, 28), (36, 26)]
    sh = Image.new('L', (Wd, Ht), 0); sd = ImageDraw.Draw(sh)
    for tx, ty in TREES: sd.ellipse([tx - 2, ty + 1, tx + 9, ty + 7], fill=255)                  # sombra de las copas sobre el césped
    sh = np.asarray(sh.filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32) / 255
    col *= (1 - 0.38 * sh * isG)[..., None]
    ground = isG | isS1 | isS2; canopy = np.zeros((Ht, Wd), bool)
    lo, hi = np.array([22, 84, 48], np.float32), np.array([112, 204, 120], np.float32)
    for tx, ty in TREES:
        col[ty:ty + 6, tx] = (112, 76, 46); col[ty:ty + 6, tx + 1] = (72, 46, 26)             # tronco
        for yy in range(ty - 8, ty + 2):                                                      # copa: elipse [tx-4, ty-8, tx+5, ty+1]
            for xx in range(tx - 4, tx + 6):
                u = (xx - (tx + 0.5)) / 5.0; w_ = (yy - (ty - 3.5)) / 5.0; r2 = u * u + w_ * w_
                if r2 > 1 or not (0 <= xx < Wd and 0 <= yy < Ht): continue
                br = max(0.0, min(1.0, -0.45 * u - 0.6 * w_ + 0.66 * (1 - r2) ** 0.5))
                c = (lo + (hi - lo) * br ** 0.9) * (1 + 0.16 * (rng.random() - 0.5))
                if r2 > 0.72: c = c * 0.80
                col[yy, xx] = c; canopy[yy, xx] = True
    alpha = ground | canopy
    out = np.zeros((Ht, Wd, 4), np.float32); out[..., :3] = grade(col, 1.08, 1.12); out[..., 3] = np.where(alpha, 255, 0)
    out[dilate(ground) & ~alpha] = K
    return to_im(out)
save(iso_parque(), 'iso_parque')

# ---------- sprites de EFECTOS (suaves, se escalan con filtro lineal): luces, sombras, niebla, viñeta, destellos ----------
def radius(w, h):
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    return (X + 0.5 - w / 2) / (w / 2), (Y + 0.5 - h / 2) / (h / 2)
def fx(alpha, rgb, name):
    o = np.zeros(alpha.shape + (4,), np.float32); o[..., :3] = rgb; o[..., 3] = np.clip(alpha, 0, 1) * 255; save(to_im(o), name)
x, y = radius(128, 128); r = np.hypot(x, y)
fx(np.clip(1 - r, 0, 1) ** 2.2, (255, 255, 255), 'fx_glow')                                                   # luz radial (se tiñe por código)
x, y = radius(32, 32); r = np.hypot(x, y)
fx(np.exp(-(r * 2.1) ** 2) * np.clip(1 - r, 0, 1) ** 0.2, (255, 255, 255), 'fx_soft')                          # mota de polvo / bokeh
rng = np.random.default_rng(42); x, y = radius(256, 128); r = np.hypot(x, y)
n = 0.55 * lowfreq(256, 128, rng, 48) + 0.30 * lowfreq(256, 128, rng, 24) + 0.15 * lowfreq(256, 128, rng, 12)
fx(np.clip((n - 0.30) / 0.55, 0, 1) * np.clip(1 - r, 0, 1) ** 1.4 * 0.92, (206, 216, 240), 'fx_fog')           # banco de niebla
x, y = radius(320, 180); r = np.hypot(x, y) / 1.2
t = np.clip((r - 0.35) / 0.85, 0, 1); fx((t * t * (3 - 2 * t)) ** 1.35 * 0.82, (6, 4, 16), 'fx_vignette')       # viñeta
x, y = radius(32, 32)
fx(np.exp(-(x * x + y * y) / 0.02) + 0.9 * np.exp(-(y * y) / 0.0035 - (x * x) / 0.35) + 0.9 * np.exp(-(x * x) / 0.0035 - (y * y) / 0.35), (255, 248, 225), 'fx_spark')   # destello en cruz
x, y = radius(64, 32)
fx(np.exp(-(x * x + y * y) * 3.2) * 0.9, (4, 2, 12), 'fx_shadow')                                              # sombra de contacto suave
x, _ = radius(32, 128); ty = (np.mgrid[0:128, 0:32][0].astype(np.float32) + 0.5) / 128
fx(np.exp(-(x / 0.5) ** 2) * ty ** 1.4 * 0.82, (255, 255, 255), 'fx_beam')                                      # haz de luz vertical (más fuerte abajo)
ty = (np.mgrid[0:64, 0:320][0].astype(np.float32) + 0.5) / 64
fx((1 - ty) ** 1.6, (255, 255, 255), 'fx_haze_t'); fx(ty ** 1.6, (255, 255, 255), 'fx_haze_b')                  # bruma arriba / abajo (profundidad)
fx(np.ones((4, 4), np.float32), (255, 255, 255), 'fx_solid')                                                   # color plano (gradación)

print('ok', len(os.listdir(OUT)), 'imágenes en', OUT)
