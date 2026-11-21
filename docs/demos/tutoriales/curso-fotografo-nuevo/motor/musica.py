#!/usr/bin/env python3
"""Compone las pistas de fondo del curso (originales, sin derechos de terceros). Necesita numpy.
Cada pista: tonalidad, tempo, progresión e instrumentos propios. Salida: musica/NN-nombre.wav (estéreo, 44,1 kHz)."""
import os, subprocess, wave
import numpy as np

SR = 44100
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, "musica"); os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def env(n, a, d, sus=0.0, r=0.05):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * (sus + (1 - sus) * np.exp(-t / max(d, 1e-4)))
    tail = int(r * SR)
    if tail and tail < n: e[-tail:] *= np.linspace(1, 0, tail)
    return e

def epiano(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2*np.pi*f*t) + 0.28*np.sin(2*np.pi*2*f*t)*np.exp(-t/0.35) + 0.08*np.sin(2*np.pi*3.01*f*t)*np.exp(-t/0.15)
    return s * env(n, 0.004, 0.9, 0.0, 0.08) * (1 + 0.04*np.sin(2*np.pi*4.5*t))
def marimba(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2*np.pi*f*t)*np.exp(-t/0.45) + 0.35*np.sin(2*np.pi*3.93*f*t)*np.exp(-t/0.06) + 0.1*np.sin(2*np.pi*9.4*f*t)*np.exp(-t/0.02)
    return s * env(n, 0.002, 10, 1, 0.03)
def cajita(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2*np.pi*f*t) + 0.4*np.sin(2*np.pi*2.76*f*t)*np.exp(-t/0.2) + 0.2*np.sin(2*np.pi*5.4*f*t)*np.exp(-t/0.08)
    return s * env(n, 0.002, 0.6, 0, 0.05)
def pad(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2*np.pi*f*dt*t + ph) for dt, ph in [(1, 0), (1.004, 1.1), (0.996, 2.3), (2.002, 0.5)]) / 3.2
    return s * env(n, min(0.9, dur/3), 1e9, 1, min(0.9, dur/3))
def bajo(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*2*f*t)) * env(n, 0.006, 0.5, 0.35, 0.06)
def bombo(dur=0.4):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 52 + 70*np.exp(-t/0.03)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t/0.12)
def platillo(dur=0.08, brillo=1.0):
    n = int(dur * SR); x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))
    return x * np.exp(-np.arange(n)/SR/(0.025*brillo)) * 0.35
def shaker(dur=0.12):
    n = int(dur * SR); x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))
    t = np.arange(n)/SR; return x * np.minimum(1, t/0.02) * np.exp(-t/0.04) * 0.25

ESCALA = [0, 2, 4, 5, 7, 9, 11]
def acorde(raiz, grado, notas=4):
    """Acorde por terceras sobre el grado (0 = I) de la escala mayor de «raiz»."""
    out = []
    for k in range(notas):
        g = grado + 2*k; out.append(raiz + ESCALA[g % 7] + 12*(g // 7))
    return out

def poner(buf, s, t):
    i = int(t * SR); j = min(len(buf), i + len(s))
    if i < len(buf): buf[i:j] += s[:j-i]

def componer(p, dur=150.0):
    L = np.zeros(int(dur*SR)); R = np.zeros_like(L)
    beat = 60.0 / p["bpm"]; compas = 4*beat; t = 0.0; k = 0
    inst = {"epiano": epiano, "marimba": marimba, "cajita": cajita}[p["inst"]]
    while t < dur:
        notas = acorde(p["raiz"], p["prog"][k % len(p["prog"])])
        if p.get("pad"):
            for m in notas[:3]:
                s = pad(hz(m - 12), compas*1.05) * 0.10; poner(L, s, t); poner(R, s, t)
        b = bajo(hz(notas[0] - 24), beat*1.6) * 0.30
        for x in p["bajo"]: poner(L, b*0.9, t + x*beat); poner(R, b*0.9, t + x*beat)
        for i, (paso, idx) in enumerate(p["patron"]):
            m = notas[idx % len(notas)] + 12*(idx // len(notas)) + p.get("oct", 0)
            sw = p.get("swing", 0) * beat if (i % 2) else 0
            s = inst(hz(m), beat*1.8) * 0.16 * (0.85 + 0.3*rng.random())
            pan = 0.5 + 0.35*np.sin(i*1.7 + k)
            poner(L, s*(1.2-pan), t + paso*beat + sw); poner(R, s*(0.2+pan), t + paso*beat + sw)
        for x in p.get("bombo", []): s = bombo()*0.22; poner(L, s, t+x*beat); poner(R, s, t+x*beat)
        for x in p.get("plat", []): s = platillo()*0.5; poner(L, s*0.8, t+x*beat); poner(R, s, t+x*beat)
        for x in p.get("shaker", []): s = shaker(); poner(L, s, t+x*beat); poner(R, s*0.8, t+x*beat)
        t += compas; k += 1
    st = np.stack([L, R], 1); st /= np.abs(st).max() + 1e-9
    return (st * 0.8 * 32767).astype(np.int16)

O = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
PISTAS = [
    ("01-manana", dict(bpm=92, raiz=60, prog=[0, 5, 3, 4], inst="epiano", patron=[(x, i) for x, i in zip(O, [0, 1, 2, 3, 4, 3, 2, 1])], bajo=[0, 2.5], plat=[1, 3], swing=0.08, pad=True)),
    ("02-pasos", dict(bpm=100, raiz=62, prog=[0, 4, 5, 3], inst="marimba", patron=[(x/2, i) for x, i in zip(range(16), [0,2,1,3,2,4,3,1, 0,2,1,3,4,3,2,1])], bajo=[0, 1.5, 2], bombo=[0, 2], oct=12)),
    ("03-foco", dict(bpm=78, raiz=57, prog=[5, 3, 0, 4], inst="epiano", patron=[(0, 0), (1, 2), (2, 4), (3, 2)], bajo=[0], pad=True, oct=12)),
    ("04-brisa", dict(bpm=96, raiz=64, prog=[0, 3, 5, 4], inst="marimba", patron=[(0.5, 2), (1.5, 3), (2.5, 4), (3.5, 3)], bajo=[0, 2], shaker=O, pad=True)),
    ("05-taller", dict(bpm=104, raiz=65, prog=[1, 4, 0, 5], inst="epiano", patron=[(1, 0), (1, 1), (1, 2), (3, 0), (3, 1), (3, 2), (3.5, 3)], bajo=[0, 0.75, 2, 2.75], bombo=[0, 2.5], plat=O, swing=0.1)),
    ("06-luz", dict(bpm=88, raiz=67, prog=[0, 1, 3, 0], inst="cajita", patron=[(x, i) for x, i in zip(O, [4, 2, 5, 3, 6, 4, 2, 0])], bajo=[0, 2], pad=True, oct=12)),
    ("07-ruta", dict(bpm=110, raiz=58, prog=[0, 2, 3, 4], inst="epiano", patron=[(x, i) for x, i in zip(O, [0, 2, 4, 2, 1, 3, 4, 3])], bajo=[0, 1, 1.5, 2.5, 3], bombo=[0, 1.5, 2], plat=[1, 3], shaker=O)),
    ("08-calma", dict(bpm=70, raiz=61, prog=[0, 5, 1, 4], inst="cajita", patron=[(0, 0), (0.75, 2), (1.5, 4), (2.5, 3), (3.25, 1)], bajo=[0], pad=True, oct=12)),
]

if __name__ == "__main__":
    for nombre, p in PISTAS:
        crudo = os.path.join(OUT, nombre + "-crudo.wav")
        with wave.open(crudo, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(componer(p).tobytes())
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", crudo, "-af",
                        "aecho=0.8:0.6:70|130:0.22|0.14,lowpass=f=9000,highpass=f=40,loudnorm=I=-20:TP=-2,afade=t=in:d=1.5",
                        os.path.join(OUT, nombre + ".wav")], check=True)
        os.remove(crudo); print(nombre)
