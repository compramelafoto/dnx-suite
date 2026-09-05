"""Detecta la marca de sincronismo en el video renderizado, ancla la voz a lo medido
y arma el video final (la marca se elimina con un recorte del 2%)."""
import json, re, subprocess, sys, pathlib
D = pathlib.Path(sys.argv[1])
plan = json.load(open(D/'plan.json')); tv = json.load(open(D/'tiempos-voz.json'))
mm = json.load(open(D/'marcas-master.json')); mp = json.load(open(D/'marcas-pantalla.json'))
A = D/'audio'; FPS = 12.0

def sh(c): return subprocess.run(c, capture_output=True, text=True)

# ---- 1. leer la marca (esquina inferior derecha) ----
crudo = subprocess.run(['ffmpeg','-v','error','-i',str(D/'video.mp4'),'-vf',
    f"crop=20:20:1894:1054,fps={int(FPS)},scale=2:2:flags=area,format=gray",'-f','rawvideo','-'],
    capture_output=True).stdout
vals = [sum(crudo[i:i+4]) / 4 for i in range(0, len(crudo) - 3, 4)]
cambios = [i / FPS for i in range(1, len(vals)) if abs(vals[i] - vals[i-1]) > 90]
# unir detecciones contiguas
limpio = []
for c in cambios:
    if not limpio or c - limpio[-1] > 0.5: limpio.append(c)
print(f"marca: {len(limpio)} cambios detectados para {len(plan['escenas'])} escenas")

ids = [e['id'] for e in plan['escenas']]
if len(limpio) < len(ids):
    print("  AVISO: faltan cambios; se completa con el plan")
inicio_plan, t = {}, plan['intro']
for e in plan['escenas']:
    inicio_plan[e['id']] = t; t += e['dur']
total = t
ancla = {}
for i, id_ in enumerate(ids):
    ancla[id_] = round(limpio[i], 3) if i < len(limpio) else inicio_plan[id_]
print(f"{'escena':<13} {'plan':>8} {'medido':>8} {'dif':>7}")
for id_ in ids:
    print(f"{id_:<13} {inicio_plan[id_]:8.2f} {ancla[id_]:8.2f} {ancla[id_]-inicio_plan[id_]:+7.2f}")

# ---- 2. niveles ----
def lufs(f):
    m = re.search(r'I:\s+(-?\d+\.\d+) LUFS', sh(['ffmpeg','-hide_banner','-i',str(f),'-af','ebur128=framelog=quiet','-f','null','-']).stderr)
    return float(m.group(1)) if m else None
def pico(f):
    m = re.search(r'max_volume:\s+(-?\d+\.\d+) dB', sh(['ffmpeg','-hide_banner','-i',str(f),'-af','volumedetect','-f','null','-']).stderr)
    return float(m.group(1)) if m else -99.0
VOZ, MUS = lufs(A/'voz-pausada.mp3'), lufs(A/'musica.mp3')
gan_mus = 10 ** ((VOZ - 12.0 - MUS) / 20)
OBJ = {'sting': -14, 'copiar': -24, 'enviar': -19, 'acredita': -16, 'aviso': -19, 'outro': -15}
gan = {k: round(min(10 ** ((o - pico(A/f'sfx-{k}.mp3')) / 20), 4), 4) for k, o in OBJ.items()}
print(f"\nvoz {VOZ:.1f} LUFS · música a {VOZ-12:.1f} (x{gan_mus:.3f})")

# ---- 3. voz anclada a lo medido ----
pistas, prev, base_ini = [], None, None
for f in tv['frases']:
    base = re.sub(r'2$', '', f['escena'])
    if base == prev:
        seg = base_ini + (f['inicio'] - base_frase_ini)
    else:
        seg = ancla[base] + 0.25; base_ini = seg; base_frase_ini = f['inicio']
    pistas.append((A/'frases'/f['archivo'], round(seg - f['enFrase'], 3), 1.0, True))
    prev = base

# ---- 4. efectos, con su posición dentro de la escena ----
pag = {}
for x in mm['marcas']: pag.setdefault(x['id'], []).append(x['t'])
def dentro(marca_id, escena):
    """desplazamiento del efecto respecto del arranque de su escena, medido en la página"""
    return [t - pag[escena][0] for t in pag.get(marca_id, [])]
pistas.append((A/'sfx-sting.mp3', 0.0, gan['sting'], False))
for i, id_ in enumerate(ids):
    for d in dentro('paso', id_) if id_ in pag else []:
        if 0 <= d < 1.0: pistas.append((A/'sfx-copiar.mp3', ancla[id_] + d, gan['copiar'], False))
for d in dentro('resultado', 'ventas'): pistas.append((A/'sfx-acredita.mp3', ancla['ventas'] + d, gan['acredita'], False))
for d in dentro('creado', 'listo'):     pistas.append((A/'sfx-enviar.mp3', ancla['listo'] + d, gan['enviar'], False))
for d in dentro('outro', 'cierre'):     pistas.append((A/'sfx-outro.mp3', ancla['cierre'] + d, gan['outro'], False))
pistas.append((A/'sfx-aviso.mp3', ancla['proximamente'] + mp['boton'], gan['aviso'], False))

# ---- 5. render final (el recorte del 2% se lleva la marca) ----
cmd = ['ffmpeg','-v','error','-y','-i',str(D/'video.mp4'),'-i',str(A/'musica.mp3')]
for p,_,_,_ in pistas: cmd += ['-i', str(p)]
f = [f"[0:v]crop=1872:1053:8:8,scale=1920:1080:flags=lanczos,setsar=1[v]",
     f"[1:a]volume={gan_mus:.4f},afade=t=in:st=0:d=2.5,afade=t=out:st={total-4:.2f}:d=4[mus]"]
ev, es = [], []
for i,(p,seg,g,es_voz) in enumerate(pistas):
    f.append(f"[{2+i}:a]volume={max(g,0.001):.4f},adelay={int(max(seg,0)*1000)}|{int(max(seg,0)*1000)}[a{i}]")
    (ev if es_voz else es).append(f"[a{i}]")
f.append(''.join(ev) + f"amix=inputs={len(ev)}:normalize=0[voz]")
f.append(''.join(es) + f"amix=inputs={len(es)}:normalize=0[sfx]")
f.append("[voz]asplit=2[voz1][llave]")
f.append("[mus][llave]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[musduck]")
f.append("[voz1][sfx][musduck]amix=inputs=3:normalize=0,apad[a]")
cmd += ['-filter_complex', ';'.join(f), '-map','[v]','-map','[a]',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','21','-preset','medium','-movflags','+faststart',
        '-c:a','aac','-b:a','192k','-shortest', str(D/'crudo.mp4')]
r = sh(cmd)
print('render final:', 'OK' if r.returncode == 0 else 'FALLÓ')
if r.returncode: print(r.stderr[-900:]); sys.exit(1)
