#!/usr/bin/env python3
"""Monta una clase: apertura + (pantalla filmada o placa por cada toma, ajustada a la voz) + cierre.
Uso: python3 montar.py C01 [C02 ...]
La voz sale de limpio/Cxx.wav; cada toma empieza donde la voz dice su «ancla» (txl/Cxx.json, palabra por palabra).
"""
import difflib, json, os, re, subprocess, sys, unicodedata
from clases import CLASES

AQUI = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(AQUI, "filmar")
PISTAS = sorted(f for f in os.listdir(os.path.join(AQUI, "musica")) if f.endswith(".wav"))  # compuestas con musica.py
def musica(c): return os.path.join(AQUI, "musica", PISTAS[(int(c[1:]) - 1) % len(PISTAS)])
APERTURA, CIERRE, FPS = 3.2, 3.5, 30
os.makedirs(os.path.join(AQUI, "videos"), exist_ok=True)
os.makedirs(os.path.join(AQUI, "trozos"), exist_ok=True)

def run(*a): subprocess.run(list(a), check=True)
def dur(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]))
def norm(s): return re.sub(r"[^a-z0-9ñ ]", "", unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()).split()

def palabras(c):
    d = json.load(open(os.path.join(AQUI, "txl", c + ".json")))
    out = []
    for s in d["transcription"]:
        for w in norm(s["text"]): out.append((s["offsets"]["from"] / 1000, w))
    return out

def ancla(ws, texto, desde):
    obj = norm(texto)
    for i in range(len(ws) - len(obj) + 1):
        if ws[i][0] + 0.01 < desde: continue
        if all(difflib.SequenceMatcher(None, a, b).ratio() >= 0.7 for (_, a), b in zip(ws[i:i + len(obj)], obj)): return ws[i][0]
    raise SystemExit(f"No encontré «{texto}» después de {desde:.1f}s")

_cache = {}
def tam(f):
    w, h = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f]).decode().strip().split(",")
    return int(w), int(h)
def marcas_reales(nombre):
    """Tiempos de cada marca en el video, leídos del cuadradito de color de la esquina (rojo/verde/azul)."""
    if nombre in _cache: return _cache[nombre]
    m = json.load(open(os.path.join(F, "tomas", nombre + ".json")))
    orden = m.get("__orden")
    if not orden: _cache[nombre] = m; return m
    W, H = tam(os.path.join(F, "tomas", nombre + ".webm"))
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", os.path.join(F, "tomas", nombre + ".webm"), "-vf",
                                   f"fps=30,crop=4:4:{W - 6}:{H - 6},scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    seg = []
    for i in range(0, len(raw), 3):
        r, g, b = raw[i], raw[i + 1], raw[i + 2]
        c = "r" if r > 180 and g < 90 and b < 90 else "g" if g > 180 and r < 90 and b < 90 else "b" if b > 180 and r < 90 and g < 90 else None
        if c and (not seg or seg[-1][1] != c): seg.append((i // 3 / 30, c))
    COL = ["r", "g", "b"]; out = dict(m); j = 0
    for k, nom in enumerate(orden, 1):
        quiero = COL[k % 3]
        while j < len(seg) and seg[j][1] != quiero: j += 1
        if j >= len(seg): raise SystemExit(f"{nombre}: no encontré la marca {nom} en el video")
        out[nom] = seg[j][0]; j += 1
    _cache[nombre] = out
    return out

def trozo(salida, D, fuente):
    """Video de D segundos a 1920x1080 desde una placa (png) o un tramo filmado (webm, desde, hasta)."""
    if isinstance(fuente, str):  # placa fija con un zoom muy lento
        png = os.path.join(F, "placas", fuente + ".png")
        n = int(D * FPS) + 1
        run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", png, "-t", f"{D:.3f}",
            "-vf", f"scale=2112:1188,zoompan=z='1+0.035*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps={FPS},format=yuv420p",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", salida)
        return
    nombre, a, b, capa = (list(fuente) + [None])[:4]
    marcas = marcas_reales(nombre)
    def t(x):
        if not isinstance(x, str): return x
        nom, _, menos = x.partition("-")
        return marcas[nom] - (float(menos) if menos else 0)
    ta, tb = t(a), t(b)
    L = tb - ta
    vel = 1.0
    if L > D: vel = min(L / D, 2.5)
    usado = min(L, D * vel)
    W, H = tam(os.path.join(F, "tomas", nombre + ".webm"))
    if W >= H:
        encuadre = "crop=1266:712:0:0,scale=1920:1080:flags=lanczos"
    else:  # celular: al centro, sobre el fondo crema del curso
        encuadre = f"crop={W - 12}:{H - 12}:0:0,scale=-2:1000:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xefe9e1"
    filtros = f"trim={ta:.3f}:{ta + usado:.3f},setpts=(PTS-STARTPTS)/{vel:.4f},fps={FPS},{encuadre}"
    resto = D - usado / vel
    if resto > 0.02: filtros += f",tpad=stop_mode=clone:stop_duration={resto:.3f}"
    entradas = ["-i", os.path.join(F, "tomas", nombre + ".webm")]
    if capa:
        entradas += ["-loop", "1", "-i", os.path.join(F, "placas", capa + ".png")]
        fc = f"[0:v]{filtros}[v];[1:v]format=rgba[c];[v][c]overlay=0:0:shortest=1,format=yuv420p[o]"
    else:
        fc = f"[0:v]{filtros},format=yuv420p[o]"
    run("ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", fc, "-map", "[o]", "-t", f"{D:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", salida)

def montar(c):
    cl = CLASES[c]; voz = os.path.join(AQUI, "final", c + ".wav"); DV = dur(voz)
    ws = palabras(c); inicios = []; t = 0
    for toma in cl["tomas"]:
        t = 0.0 if not inicios else max(0, ancla(ws, toma["voz"], t) - 0.12)
        inicios.append(t)
    inicios.append(DV)
    lista = []
    def agregar(nombre, D, fuente):
        f = os.path.join(AQUI, "trozos", f"{c}-{nombre}.mp4"); trozo(f, D, fuente); lista.append(f)
    agregar("00", APERTURA, f"apertura-{c}")
    for i, toma in enumerate(cl["tomas"]):
        D = inicios[i + 1] - inicios[i] + (0.25 if i == len(cl["tomas"]) - 1 else 0)
        agregar(f"{i + 1:02d}", D, toma["pantalla"])
        print(f"  toma {i + 1}: voz {inicios[i]:.1f}–{inicios[i + 1]:.1f}s")
    agregar("99", CIERRE, "cierre")
    lst = os.path.join(AQUI, "trozos", c + ".txt")
    open(lst, "w").write("".join(f"file '{x}'\n" for x in lista))
    mudo = os.path.join(AQUI, "trozos", c + "-mudo.mp4")
    run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", mudo)
    total = dur(mudo)
    salida = os.path.join(AQUI, "videos", f"{c}.mp4")
    fc = (f"[1:a]adelay={int(APERTURA * 1000)}|{int(APERTURA * 1000)},apad[v];"
          f"[v]asplit=2[v1][llave];"
          f"[2:a]aloop=loop=-1:size=2e9,atrim=0:{total:.3f},aformat=channel_layouts=stereo,volume=-9dB,afade=t=in:d=1.2,afade=t=out:st={total - 2.5:.3f}:d=2.5[m0];"
          f"[llave]aformat=channel_layouts=stereo[ll];[m0][ll]sidechaincompress=threshold=0.015:ratio=8:attack=60:release=700:makeup=1[m];"
          f"[v1]aformat=channel_layouts=stereo[vv];[vv][m]amix=inputs=2:duration=first:normalize=0,atrim=0:{total:.3f}[a]")
    run("ffmpeg", "-v", "error", "-y", "-i", mudo, "-i", voz, "-i", musica(c), "-filter_complex", fc,
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", salida)
    print(c, "listo:", salida, f"{total:.1f}s")

if __name__ == "__main__":
    for c in sys.argv[1:]: montar(c)
