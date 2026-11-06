#!/usr/bin/env python3
"""Genera TODO el audio del juego en "My project/assets/audio" (.ogg) por síntesis: no usa muestras ni descargas, así que no hay derechos de terceros.

  python3 tools/make_audio.py            (desde la raíz del repo; requiere numpy, scipy y ffmpeg con libvorbis)

  musica_menu.ogg   64 s  bucle sin costura. Pad cálido (Am9 · Fmaj9 · Cmaj9 · G6) con arpegios suaves de piano eléctrico.
  musica_nivel.ogg  58 s  bucle sin costura. Más luminosa (Dmaj9 · Bm9 · Gmaj9 · A6/9), más lenta y espaciada.
  tren_a.ogg / tren_b.ogg  16 s  tren lejano que pasa de izquierda a derecha / de derecha a izquierda (retumbo, zumbido con efecto
                          Doppler, soplo de aire y golpeteo entre vagones). Se reproduce cada 60 s a volumen bajo (src/audio.js).
  sfx_*.ogg         efectos cortos y suaves de interfaz (clic, selección, viaje, noticia, moneda, tienda, suerte, error, ganar, perder).
  peligro_loop.ogg  5 s   bucle sin costura de "apresúrate": latido (96 lpm) + tic de reloj + zumbido grave tenso (segunda menor). Suena en el
                          Nivel mientras quede menos del 15 % del tiempo o del dinero (src/audio.js).
  sfx_alerta.ogg    0.6 s aviso corto (dos pitidos agudos y un golpe grave) al ENTRAR en apuro.
  sfx_asalto.ogg    ~1 s  golpe seco de ataque brusco (ráfaga de ruido + golpe grave + racimo disonante) cuando te asaltan.

El volumen con el que suena cada uno en el juego se define en src/audio.js; aquí solo se normaliza el nivel de cada archivo."""
import os, subprocess, wave, tempfile
import numpy as np
from scipy import signal

SR = 44100
OUT = 'My project/assets/audio'
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------------------------------------------------------- utilidades
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def lowpass(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x, axis=-1)
def highpass(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x, axis=-1)
def bandpass(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=-1)

def smooth_env(n, attack, release):
    """Envolvente con ataque y caída en coseno (sin clics)."""
    e = np.ones(n)
    na, nr = min(n, int(attack * SR)), min(n, int(release * SR))
    if na: e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if nr: e[n - nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e

def pan_gains(p): return np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)   # reparto de potencia constante, p en [-1, 1]

def make_ir(rt60, seed, pre=0.02, lp=5500, dur=None):
    """Respuesta al impulso sintética (ruido con caída exponencial y agudos que se apagan antes). Estéreo y de energía unitaria."""
    rng = np.random.default_rng(seed); n = int((dur or rt60 * 1.25) * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-6.9078 * t / rt60)
    ir = lowpass(ir, lp, 1) * 0.6 + lowpass(ir, lp / 3, 1) * 0.4 * np.exp(-1.5 * t / rt60)
    ir = np.concatenate([np.zeros((2, int(pre * SR))), ir], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))

def normalize(x, peak=None, rms_db=None):
    if rms_db is not None: x = x * (10 ** (rms_db / 20) / (np.sqrt((x ** 2).mean()) + 1e-12))
    if peak is not None: x = x * (peak / (np.abs(x).max() + 1e-12))
    return x

def write_ogg(name, x, quality, mono=False):
    """x: (n,) o (2, n) en [-1, 1] → .ogg (Vorbis) con ffmpeg."""
    x = np.atleast_2d(x)
    if mono and x.shape[0] > 1: x = x.mean(axis=0, keepdims=True)
    pcm = (np.clip(x, -1, 1).T * 32767).astype('<i2')
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, name + '.wav')
        with wave.open(wav, 'wb') as w:
            w.setnchannels(pcm.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        dst = os.path.join(OUT, name + '.ogg')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', str(quality), dst], check=True)
    print(f'  {name}.ogg  {x.shape[1] / SR:5.1f} s  {os.path.getsize(os.path.join(OUT, name + ".ogg")) / 1024:6.0f} KB')


# ------------------------------------------------------------------------------------------------------- búfer circular (bucles)
class Loop:
    """Búfer estéreo circular: lo que se sale por el final entra por el principio, así el bucle no tiene costura."""
    def __init__(self, seconds): self.n = int(round(seconds * SR)); self.buf = np.zeros((2, self.n))
    def add(self, t0, sig, pan=0.0):
        s = int(round(t0 * SR)) % self.n; first = min(len(sig), self.n - s); gl, gr = pan_gains(pan)
        for ch, g in ((0, gl), (1, gr)):
            self.buf[ch, s:s + first] += sig[:first] * g
            if len(sig) > first: self.buf[ch, :len(sig) - first] += sig[first:] * g
    def reverb(self, ir):          # convolución circular por FFT: la cola de la reverb también da la vuelta
        n = self.n; F = np.fft.rfft(np.pad(ir, ((0, 0), (0, n - ir.shape[1]))), axis=1)
        return np.fft.irfft(np.fft.rfft(self.buf, axis=1) * F, n, axis=1)


# ------------------------------------------------------------------------------------------------------------------ instrumentos
def pad_note(freq, dur, rng, attack=1.8, release=2.4):
    """Nota de pad cálida: 6 armónicos que decaen, desafinados en coro y con vibrato lento."""
    n = int(dur * SR); t = np.arange(n) / SR; sig = np.zeros(n)
    for h in range(1, 7):
        for det in (-0.0032, 0.0032):
            ph = rng.uniform(0, 2 * np.pi)
            sig += np.sin(2 * np.pi * freq * h * (1 + det) * t + 0.5 * np.sin(2 * np.pi * 0.18 * t + ph) + ph) / h ** 1.7
    return sig * smooth_env(n, attack, release) / 6

def bass_note(freq, dur, attack=0.9, release=2.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) + 0.22 * np.sin(2 * np.pi * 2 * freq * t)) * smooth_env(n, attack, release)

def epiano(freq, vel, dur=2.6, decay=3.0):
    """Piano eléctrico suave (tipo Rhodes): fundamental + armónicos que se apagan rápido + campanita inarmónica muy breve."""
    n = int(dur * SR); t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * freq * t) * np.exp(-decay * t) + 0.32 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-2.1 * decay * t)
           + 0.12 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-3.2 * decay * t) + 0.06 * np.sin(2 * np.pi * 4.17 * freq * t) * np.exp(-9 * decay * t))
    return sig * vel * (1 - np.exp(-t / 0.004))                     # ataque de 4 ms (sin clic)

def bell(freq, dur, decay=2.4, vel=1.0):
    """Campana/vibráfono: parciales inarmónicos con caídas distintas."""
    n = int(dur * SR); t = np.arange(n) / SR; sig = np.zeros(n)
    for ratio, amp, d in ((1, 1.0, 1), (2.76, 0.42, 1.7), (5.40, 0.18, 2.6), (8.93, 0.07, 4)):
        sig += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-decay * d * t)
    return sig * vel * (1 - np.exp(-t / 0.002))


# ------------------------------------------------------------------------------------------------------------------------ música
def compose(name, bpm, bars_per_chord, chords, seed, arp_step, arp_prob, arp_oct=0, reverb_rt=3.2, quality=3, rms_db=-21):
    """chords: [(bajo, [pad...], [arpegio...])] en notas MIDI. Cada acorde dura bars_per_chord compases de 4 tiempos."""
    rng = np.random.default_rng(seed); beat = 60.0 / bpm; chord_dur = bars_per_chord * 4 * beat; total = chord_dur * len(chords)
    L = Loop(total); overlap = 2.4
    for ci, (bass, pad, arp) in enumerate(chords):
        t0 = ci * chord_dur
        L.add(t0 - overlap / 2, bass_note(midi(bass), chord_dur + overlap, 1.0, 2.2) * 0.9, 0.0)
        for k, m in enumerate(pad):                                       # pad repartido en el panorama estéreo
            L.add(t0 - overlap / 2, pad_note(midi(m), chord_dur + overlap, rng) * (0.55 if k % 2 else 0.7), -0.55 + 1.1 * k / max(1, len(pad) - 1))
        idx = int(rng.integers(len(arp))); steps = int(round(chord_dur / (arp_step * beat)))
        for s in range(steps):                                            # arpegio disperso: salta de a poco, sin repetir y con silencios
            if rng.random() > arp_prob * (1.0 if s % 2 == 0 else 0.7): continue
            idx = int(np.clip(idx + rng.choice([-2, -1, 1, 2]), 0, len(arp) - 1))
            vel = 0.30 + 0.30 * rng.random()
            L.add(t0 + s * arp_step * beat + rng.uniform(0, 0.03), epiano(midi(arp[idx] + 12 * arp_oct), vel), rng.uniform(-0.5, 0.5))
        if ci % 2 == 0:                                                   # un destello agudo por cada dos acordes
            L.add(t0 + 1.5 * beat, bell(midi(arp[-1] + 12), 3.0, 1.6, 0.10), rng.uniform(-0.6, 0.6))
    dry = L.buf; wet = L.reverb(make_ir(reverb_rt, seed + 1))
    def circular(f, x):            # un filtro causal arranca con estado cero y rompería el empalme: se filtra sobre 3 copias y se toma la del medio
        n = x.shape[1]; return f(np.tile(x, (1, 3)))[:, n:2 * n]
    mix = circular(lambda x: highpass(lowpass(x, 6500), 45), dry * 0.75 + wet * 0.55)
    pre = mix.copy()
    mix = normalize(mix, rms_db=rms_db)
    peak = np.abs(mix).max()
    if peak > 0.8: mix *= 0.8 / peak
    jump = np.abs(pre[:, 0] - pre[:, -1]).max() / (np.abs(np.diff(pre, axis=1)).mean() + 1e-12)
    print(f'  [{name}] salto en el empalme del bucle = {jump:.1f} veces la variación típica entre muestras (≈1 = sin costura)')
    e = smooth_env(mix.shape[1], 0.12, 0.12); write_ogg(name, mix * e, quality)   # 120 ms a cada extremo: ningún clic aunque el navegador deje un hueco


# --------------------------------------------------------------------------------------------------------------------------- tren
def train_pass(name, flip, seed, dur=16.0, rms_db=-26):
    """Tren lejano que pasa: amplitud ∝ 1/distancia, efecto Doppler en el zumbido, soplo de aire en el punto más cercano y panorama
    de un lado al otro. flip=True lo hace pasar de derecha a izquierda."""
    rng = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR; t0 = dur / 2
    u = (t - t0) / 2.4; d = np.sqrt(0.55 ** 2 + u ** 2); a = 0.55 / d                      # distancia relativa y volumen
    side = np.tanh(u * 0.7) * (-1 if flip else 1)                                           # -1 izquierda … +1 derecha
    # 1) retumbo grave (ruido marrón, solo graves)
    rumble = lowpass(highpass(np.cumsum(rng.standard_normal(n)) / 400.0, 25), 210) * a ** 1.1
    rumble /= np.abs(rumble).max()
    # 2) rodadura / traqueteo de bogies: ruido de banda media modulado al ritmo de los ejes
    roll = bandpass(rng.standard_normal(n), 350, 1700) * (0.55 + 0.45 * np.sin(2 * np.pi * 6.3 * t * (1 + 0.04 * np.tanh(-u))) ** 2) * a ** 1.6
    roll /= np.abs(roll).max()
    # 3) zumbido de motor con Doppler (más agudo al acercarse, más grave al alejarse) y armónicos
    f = 410 * (1 + 0.075 * (-u / d)); ph = 2 * np.pi * np.cumsum(f) / SR
    hum = (np.sin(ph) + 0.5 * np.sin(2 * ph + 0.7) + 0.25 * np.sin(3 * ph + 1.9)) * (1 + 0.08 * np.sin(2 * np.pi * 7.1 * t)) * a ** 1.3
    hum /= np.abs(hum).max()
    # 4) soplo de aire al pasar (ruido filtrado con pico estrecho)
    whoosh = bandpass(rng.standard_normal(n), 500, 3200) * np.exp(-((t - t0) / 0.9) ** 2)
    whoosh /= np.abs(whoosh).max()
    # 5) golpes graves entre vagones (cada ~0.9 s) cuando está cerca
    clunk = np.zeros(n)
    for ct in np.arange(t0 - 4.5, t0 + 4.5, 0.9):
        i = int(ct * SR); m = int(0.22 * SR); tt = np.arange(m) / SR
        clunk[i:i + m] += np.sin(2 * np.pi * 62 * tt) * np.exp(-tt * 16) * (a[min(i, n - 1)] ** 1.4)
    clunk /= np.abs(clunk).max()
    mono = 1.0 * rumble + 0.30 * roll + 0.22 * hum + 0.55 * whoosh + 0.35 * clunk
    gl = np.cos((side + 1) * np.pi / 4); gr = np.sin((side + 1) * np.pi / 4)
    dry = np.stack([mono * gl, mono * gr])
    wet = np.stack([signal.fftconvolve(dry[c], make_ir(1.1, seed + 10 + c)[c])[:n] for c in range(2)])    # eco de túnel
    mix = dry * 0.8 + wet * 0.35
    mix *= smooth_env(n, 3.0, 3.5)                                                           # entra y sale con suavidad desde el silencio
    mix = normalize(mix, rms_db=rms_db); peak = np.abs(mix).max()
    if peak > 0.8: mix *= 0.8 / peak
    write_ogg(name, mix, 4)


# ----------------------------------------------------------------------------------------------------------------- efectos de UI
SFX_IR = make_ir(0.7, 77)[0]
def with_reverb(x, wet=0.25):
    tail = np.concatenate([x, np.zeros(int(0.8 * SR))]); return tail * (1 - wet * 0.5) + signal.fftconvolve(tail, SFX_IR)[:len(tail)] * wet
def seq(parts, length):
    """parts: [(t, señal)] → una pista mono de `length` s."""
    out = np.zeros(int(length * SR))
    for t, s in parts:
        i = int(t * SR); out[i:i + len(s)] += s[:max(0, len(out) - i)]
    return out
def sfx(name, x, peak=0.6, quality=4):
    x = x[:np.nonzero(np.abs(x) > 1e-4)[0][-1] + 1]                                        # recorta el silencio final
    x = x * smooth_env(len(x), 0.002, 0.03)
    write_ogg(name, normalize(x, peak=peak), quality, mono=True)

def make_sfx():
    tone = lambda f, d, dec, v=1.0: np.sin(2 * np.pi * f * np.arange(int(d * SR)) / SR) * np.exp(-dec * np.arange(int(d * SR)) / SR) * v
    sfx('sfx_click', seq([(0, tone(740, 0.06, 55)), (0, tone(1480, 0.03, 90, 0.25))], 0.1))
    sfx('sfx_select', seq([(0, tone(659, 0.12, 22)), (0.06, tone(988, 0.22, 14, 0.9))], 0.4), 0.55)
    whoosh = lowpass(np.random.default_rng(1).standard_normal(int(0.55 * SR)), 1100) * smooth_env(int(0.55 * SR), 0.2, 0.3)
    sfx('sfx_viaje', with_reverb(seq([(0, bell(784, 0.9, 3.2, 0.8)), (0.22, bell(587, 1.1, 3.0, 0.8)), (0, whoosh * 0.16)], 1.4), 0.3), 0.55)
    sfx('sfx_noticia', with_reverb(seq([(0, epiano(880, 0.7, 0.8, 5.5)), (0.13, epiano(1319, 0.7, 0.9, 5.0))], 1.1), 0.3), 0.55)
    sfx('sfx_moneda', with_reverb(seq([(0, bell(1319, 0.5, 6.0, 0.7)), (0.07, bell(1760, 0.8, 4.6, 0.8))], 1.0), 0.15), 0.55)
    sfx('sfx_tienda', with_reverb(bell(659, 1.6, 2.4, 1.0), 0.3), 0.5)
    sfx('sfx_suerte', with_reverb(seq([(i * 0.08, bell(f, 0.7, 4.0, 0.7)) for i, f in enumerate((523, 659, 784, 1047))], 1.3), 0.3), 0.5)
    sfx('sfx_error', seq([(0, tone(330, 0.09, 24)), (0.12, tone(262, 0.14, 18))], 0.35), 0.5)
    sfx('sfx_ganar', with_reverb(seq([(i * 0.16, bell(f, 1.6, 2.2, 0.75)) for i, f in enumerate((523, 659, 784, 988, 1319))] + [(0.7, bell(262, 2.2, 1.4, 0.5))], 3.2), 0.35), 0.55)
    sfx('sfx_perder', with_reverb(seq([(i * 0.34, bell(f, 1.9, 2.0, 0.7)) for i, f in enumerate((440, 349, 294, 220))], 3.4), 0.35), 0.5)


# -------------------------------------------------------------------------------------------------------------- peligro y asalto
def make_alert():
    """peligro_loop: 8 pulsos a 96 lpm = 5.0 s exactos. El zumbido usa frecuencias con ciclos enteros en 5 s (55.0 y 58.0 Hz) y el tremolo 1.6 Hz
    (8 ciclos), y todo lo demás entra en un búfer circular, así que no hay costura al repetirse."""
    L = 5.0; beat = 60 / 96; rng = np.random.default_rng(404); loop = Loop(L); n = int(L * SR); t = np.arange(n) / SR
    def thump(f0, f1, dur, dec, v):
        m = int(dur * SR); tt = np.arange(m) / SR; ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-tt * 28)) / SR
        return np.sin(ph) * np.exp(-tt * dec) * v
    def click(fc, dur, dec, v):
        m = int(dur * SR); return bandpass(rng.standard_normal(m), fc * 0.7, fc * 1.4) * np.exp(-np.arange(m) / SR * dec) * v
    def mix(*sigs):
        out = np.zeros(max(len(g) for g in sigs))
        for g in sigs: out[:len(g)] += g
        return out
    for b in range(8):                                             # latido: "lub-dub" en cada pulso (con armónicos y un "clac" medio para que se oiga también en bocinas chicas)
        t0 = b * beat; acc = 1.0 if b % 4 == 0 else 0.85
        loop.add(t0, mix(np.tanh(1.8 * thump(95, 52, 0.30, 11, 0.95 * acc)), thump(190, 104, 0.16, 20, 0.55 * acc), click(420, 0.05, 80, 0.8 * acc)), 0.0)
        loop.add(t0 + 0.19, mix(np.tanh(1.8 * thump(110, 62, 0.24, 14, 0.6 * acc)), thump(220, 124, 0.12, 24, 0.4 * acc), click(520, 0.04, 90, 0.55 * acc)), 0.0)
    for i in range(16):                                            # tic-tac de reloj en cada corchea (agudo / grave), alternando de lado; más marcado en el pulso
        loop.add(i * beat / 2, click(2300 if i % 2 == 0 else 1700, 0.035, 120, 0.85 if i % 2 == 0 else 0.55), -0.35 if i % 4 < 2 else 0.35)
    for b in range(0, 8, 2):                                       # pitido tenso (segunda menor) cada dos pulsos, en el contratiempo
        m = int(0.09 * SR); tt = np.arange(m) / SR; env = np.minimum(1, tt / 0.004) * np.exp(-tt * 20)
        loop.add(b * beat + beat * 0.62, (np.sin(2 * np.pi * 880 * tt) + np.sin(2 * np.pi * 932 * tt)) * env * 0.16, 0.0)
    body = loop.buf
    trem = 0.62 + 0.38 * np.cos(2 * np.pi * 1.6 * t)
    drone = np.tanh(1.6 * (np.sin(2 * np.pi * 55.0 * t) + np.sin(2 * np.pi * 58.0 * t) + 0.5 * np.sin(2 * np.pi * 110.0 * t) + 0.45 * np.sin(2 * np.pi * 116.0 * t))) * trem
    drone = lowpass(np.concatenate([drone, drone, drone]), 520, 2)[n:2 * n]            # filtrado circular (3 copias, la del medio) → sin salto en la unión
    x = body + np.stack([drone, drone]) * 0.14
    x = lowpass(np.concatenate([x, x, x], axis=1), 9000, 1)[:, n:2 * n]
    write_ogg('peligro_loop', x * min(0.62 / np.abs(x).max(), 10 ** (-18 / 20) / np.sqrt((x ** 2).mean())), 3)     # RMS -18 dB sin pasar de 0.62 de pico (Vorbis rebasa ~+2.5 dB en transitorios; así el archivo decodificado no recorta)

    # alerta: aviso corto (dos pitidos y un golpe grave) que suena UNA vez al entrar en apuro, para que se note de inmediato
    d = int(0.62 * SR); tt = np.arange(d) / SR; x = np.zeros(d)
    for t0, f in ((0.0, 988.0), (0.17, 988.0), (0.34, 740.0)):
        m = int(0.13 * SR); u = np.arange(m) / SR; env = np.minimum(1, u / 0.003) * np.minimum(1, (0.13 - u) / 0.02)
        beep = sum(np.sin(2 * np.pi * f * k * u) / k for k in (1, 2, 3)) * env
        x[int(t0 * SR):int(t0 * SR) + m] += beep * 0.5
    x = lowpass(x, 5200) + np.concatenate([thump(120, 55, 0.3, 12, 0.7), np.zeros(max(0, d - int(0.3 * SR)))])[:d]
    write_ogg('sfx_alerta', normalize(with_reverb(x, 0.1)[:int(0.62 * SR)], peak=0.74), 4, mono=True)

    # asalto: lo más brusco del juego, pero corto y sin llegar a ser agresivo
    d = int(1.1 * SR); tt = np.arange(d) / SR
    burst = highpass(rng.standard_normal(d), 700) * np.exp(-tt * 26)
    hit = thump(170, 42, 1.1, 8, 1.0)[:d]
    saw = lambda f: sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 7))
    cluster = np.tanh(1.5 * (saw(233.1) + saw(246.9) + 0.8 * saw(329.6) + 0.6 * saw(349.2))) * np.exp(-tt * 5.5)
    cluster = lowpass(cluster, 2600)
    x = np.tanh(1.9 * (burst * 0.7 + hit * 0.95 + cluster * 0.4))                               # saturación suave: sube la energía sin subir el pico
    x = x * np.concatenate([np.minimum(1, np.arange(int(0.0006 * SR)) / (0.0006 * SR)), np.ones(d - int(0.0006 * SR))])     # ataque de 0.6 ms
    sfx_raw = with_reverb(x, 0.16)
    sfx_raw = sfx_raw[:np.nonzero(np.abs(sfx_raw) > 1e-4)[0][-1] + 1]
    sfx_raw = sfx_raw * np.concatenate([np.ones(len(sfx_raw) - int(0.05 * SR)), np.cos(np.linspace(0, np.pi / 2, int(0.05 * SR))) ** 2])
    write_ogg('sfx_asalto', normalize(sfx_raw, peak=0.78), 4, mono=True)


if __name__ == '__main__':
    print('música')
    compose('musica_menu', 60, 2, [(45, [57, 60, 64, 67, 71], [69, 72, 76, 79, 83]),      # Am9
                                    (41, [53, 57, 60, 64, 67], [65, 69, 72, 76, 79]),      # Fmaj9
                                    (48, [52, 55, 59, 62, 64], [67, 71, 74, 76, 79]),      # Cmaj9
                                    (43, [50, 55, 59, 62, 64], [67, 71, 74, 76, 79]),      # G6
                                    (45, [57, 60, 64, 67, 71], [69, 72, 76, 79, 83]),      # Am9
                                    (41, [53, 57, 60, 64, 67], [65, 69, 72, 76, 79]),      # Fmaj9
                                    (48, [52, 55, 59, 62, 64], [67, 71, 74, 76, 79]),      # Cmaj9
                                    (40, [55, 59, 62, 66, 69], [67, 71, 74, 78, 81])],     # Em9 (cierra la vuelta)
            seed=2026, arp_step=0.5, arp_prob=0.55)
    compose('musica_nivel', 66, 2, [(50, [57, 62, 66, 69, 73], [74, 76, 78, 81, 85]),     # Dmaj9
                                    (47, [54, 57, 62, 66, 69], [71, 74, 78, 81, 83]),      # Bm9
                                    (43, [50, 55, 59, 62, 66], [67, 71, 74, 78, 81]),      # Gmaj9
                                    (45, [52, 57, 61, 64, 66], [69, 73, 76, 78, 81]),      # A6/9
                                    (50, [57, 62, 66, 69, 73], [74, 76, 78, 81, 85]),      # Dmaj9
                                    (47, [54, 57, 62, 66, 69], [71, 74, 78, 81, 83]),      # Bm9
                                    (43, [50, 55, 59, 62, 66], [67, 71, 74, 78, 81]),      # Gmaj9
                                    (45, [52, 57, 61, 64, 68], [69, 73, 76, 80, 81])],     # A7sus-ish (resuelve a Dmaj9)
            seed=910, arp_step=0.75, arp_prob=0.42, reverb_rt=3.6)
    print('tren')
    train_pass('tren_a', False, 31)
    train_pass('tren_b', True, 32)
    print('efectos')
    make_sfx()
    print('peligro y asalto')
    make_alert()
    print('listo ->', OUT)
