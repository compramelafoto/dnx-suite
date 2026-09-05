"""Mezcla de audio en una pasada aparte (voz + música + efectos).

Va SEPARADO del video a propósito: combinar una secuencia larga de PNG con la
cadena de audio en un solo ffmpeg lo deja colgado sin escribir nada.

Niveles calculados, no a ojo:
  - la música se mide en LUFS y se baja 12 dB por debajo de la voz;
  - cada efecto se normaliza por pico a un objetivo propio;
  - un efecto que necesite más de +12 dB está mal generado: se limita y se avisa.
"""
import json, re, subprocess, sys, pathlib
D = pathlib.Path(sys.argv[1])
plan = json.load(open(D/'plan.json')); mr = json.load(open(D/'marcas-render.json')); A = D/'audio'
CLIC_EN_CLIP = float(sys.argv[2]) if len(sys.argv) > 2 else 10.84
SEPARACION_DB = 12.0
OBJETIVO_PICO = {'sting': -13.0, 'click': -20.0, 'shutter': -15.0, 'unlock': -22.0, 'outro': -15.0}

def correr(c): return subprocess.run(c, capture_output=True, text=True)

# el paso 1 la escribe como voz.mp3; versiones viejas usaban voz-completa.mp3
VOZ_MP3 = A/'voz.mp3' if (A/'voz.mp3').exists() else A/'voz-completa.mp3'
def lufs(f):
    m = re.search(r'I:\s+(-?\d+\.\d+) LUFS', correr(['ffmpeg','-hide_banner','-i',str(f),'-af','ebur128=framelog=quiet','-f','null','-']).stderr)
    return float(m.group(1))
def pico(f):
    m = re.search(r'max_volume:\s+(-?\d+\.\d+) dB', correr(['ffmpeg','-hide_banner','-i',str(f),'-af','volumedetect','-f','null','-']).stderr)
    return float(m.group(1))

total = plan['intro'] + plan['producto'] + sum(e['dur'] for e in plan['escenas'])
cm, unlocks = {}, []
for x in mr['marcas']:
    (unlocks.append(x['t']) if x['id'] == 'unlock' else cm.__setitem__(x['id'], x['t']))

VOZ, MUS = lufs(VOZ_MP3), lufs(A/'musica.mp3')
gan_mus = 10 ** ((VOZ - SEPARACION_DB - MUS) / 20)
gan = {}
for k, obj in OBJETIVO_PICO.items():
    g = 10 ** ((obj - pico(A/f'sfx-{k}.mp3')) / 20)
    if g > 4:
        print(f"  ojo: sfx-{k} está casi mudo; se limita la ganancia (regeneralo)"); g = 4
    gan[k] = round(g, 4)
print(f"voz {VOZ:.1f} LUFS · música a {VOZ-SEPARACION_DB:.1f} LUFS (x{gan_mus:.3f}) · efectos {gan}")

pistas = [(VOZ_MP3, plan['vozOffset'], 1.0),
          (A/'sfx-sting.mp3', 0.0, gan['sting']),
          (A/'sfx-click.mp3', plan['intro'] + CLIC_EN_CLIP, gan['click']),
          (A/'sfx-shutter.mp3', cm.get('flash', 0), gan['shutter']),
          (A/'sfx-outro.mp3', cm['cierre'] + 3.0, gan['outro'])]
for i, u in enumerate(unlocks):
    pistas.append((A/'sfx-unlock.mp3', u, gan['unlock'] * (1 - i * 0.12)))

cmd = ['ffmpeg','-v','error','-y','-i', str(A/'musica.mp3')]
for p, _, _ in pistas: cmd += ['-i', str(p)]
FMT = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo'
f = [f"[0:a]{FMT},volume={gan_mus:.4f},afade=t=in:st=0:d=2.5,afade=t=out:st={total-4:.2f}:d=4[mus]"]
et = []
for i, (_, seg, g) in enumerate(pistas):
    f.append(f"[{1+i}:a]{FMT},volume={g:.4f},adelay={int(seg*1000)}|{int(seg*1000)}[a{i}]"); et.append(f"[a{i}]")
f.append(''.join(et[1:]) + f"amix=inputs={len(et)-1}:normalize=0:duration=longest[sfx]")
f.append("[a0]asplit=2[voz][llave0]")
# la llave del compresor se rellena con silencio: si no, la música se corta cuando termina la voz
f.append(f"[llave0]apad=whole_dur={total+1}[llave]")
f.append("[mus][llave]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[musduck]")
f.append("[voz][sfx][musduck]amix=inputs=3:normalize=0:duration=longest[a]")
cmd += ['-filter_complex', ';'.join(f), '-map','[a]','-t', str(total), '-c:a','pcm_s16le', str(D/'mezcla.wav')]
r = correr(cmd)
print('mezcla:', 'OK' if r.returncode == 0 else r.stderr[-600:])
