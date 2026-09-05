"""Ensambla: corrige la velocidad del render, coloca voz, música (12 dB bajo la voz) y efectos."""
import glob, json, re, subprocess, sys, pathlib
D = pathlib.Path(sys.argv[1])
plan = json.load(open(D/'plan.json')); mm = json.load(open(D/'marcas-master.json'))
mp = json.load(open(D/'marcas-producto.json')); A = D/'audio'
SEPARACION = 12.0

def sh(c): return subprocess.run(c, capture_output=True, text=True)
def lufs(f):
    m = re.search(r'I:\s+(-?\d+\.\d+) LUFS', sh(['ffmpeg','-hide_banner','-i',str(f),'-af','ebur128=framelog=quiet','-f','null','-']).stderr)
    return float(m.group(1)) if m else None
def pico(f):
    m = re.search(r'max_volume:\s+(-?\d+\.\d+) dB', sh(['ffmpeg','-hide_banner','-i',str(f),'-af','volumedetect','-f','null','-']).stderr)
    return float(m.group(1)) if m else -99.0

VOZ, MUS = lufs(A/'voz.mp3'), lufs(A/'musica.mp3')
gan_mus = 10 ** ((VOZ - SEPARACION - MUS) / 20)
print(f"voz {VOZ:.1f} LUFS | música {MUS:.1f} → {VOZ-SEPARACION:.1f} LUFS (x{gan_mus:.3f})")

OBJETIVO = {'sting': -13, 'copiar': -22, 'enviar': -18, 'moneda': -20,
            'contador': -20, 'acredita': -14, 'aviso': -18, 'outro': -15}
gan = {}
for k, obj in OBJETIVO.items():
    g = 10 ** ((obj - pico(A/f'sfx-{k}.mp3')) / 20)
    if g > 4: print(f"  ojo: sfx-{k} muy bajo, ganancia limitada"); g = 4
    gan[k] = round(g, 4)

por_id = {}
for x in mm['marcas']: por_id.setdefault(x['id'], []).append(x['t'])
esc = {k: v[0] for k, v in por_id.items()}

pistas = [(A/'voz.mp3', plan['vozOffset'], 1.0), (A/'sfx-sting.mp3', 0.0, gan['sting'])]
for i, t in enumerate(por_id.get('moneda', [])):
    pistas.append((A/'sfx-moneda.mp3', t, gan['moneda'] * (1 - i * 0.08)))
for t in por_id.get('split', []):      pistas.append((A/'sfx-copiar.mp3', t, gan['copiar'] * 1.4))
for t in por_id.get('toc', []):        pistas.append((A/'sfx-copiar.mp3', t, gan['copiar'] * 0.8))
for t in por_id.get('contador', []):   pistas.append((A/'sfx-contador.mp3', t, gan['contador']))
for t in por_id.get('acredita', []):   pistas.append((A/'sfx-acredita.mp3', t, gan['acredita']))
pistas.append((A/'sfx-aviso.mp3', por_id['aviso'][-1], gan['aviso']))     # la escena y el efecto comparten nombre: vale el último
for t in por_id.get('outro', []):      pistas.append((A/'sfx-outro.mp3', t, gan['outro']))
pistas.append((A/'sfx-copiar.mp3', esc['producto'] + mp['copiar'], gan['copiar']))
pistas.append((A/'sfx-enviar.mp3', esc['producto'] + mp['whatsapp'], gan['enviar']))

v = glob.glob(str(D/'clip-master'/'*.webm'))[0]
F = float(sh(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',v]).stdout) / mm['wall']
total = plan['intro'] + sum(e['dur'] for e in plan['escenas'])

cmd = ['ffmpeg','-v','error','-y','-i',v,'-i',str(A/'musica.mp3')]
for p,_,_ in pistas: cmd += ['-i', str(p)]
f = [f"[0:v]setpts=PTS/{F:.5f},trim=start={mm['offset']}:end={mm['offset']+total},setpts=PTS-STARTPTS,fps=25,format=yuv420p,setsar=1[v]",
     f"[1:a]volume={gan_mus:.4f},afade=t=in:st=0:d=2,afade=t=out:st={total-4:.2f}:d=4[mus]"]
et = []
for i,(_,seg,g) in enumerate(pistas):
    f.append(f"[{2+i}:a]volume={max(g,0.001):.4f},adelay={int(seg*1000)}|{int(seg*1000)}[a{i}]"); et.append(f"[a{i}]")
f.append(''.join(et[1:]) + f"amix=inputs={len(et)-1}:normalize=0[sfx]")
f.append("[a0]asplit=2[voz][llave]")
f.append("[mus][llave]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[musduck]")
f.append("[voz][sfx][musduck]amix=inputs=3:normalize=0,apad[a]")
cmd += ['-filter_complex', ';'.join(f), '-map','[v]','-map','[a]',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','slow','-movflags','+faststart',
        '-c:a','aac','-b:a','192k','-shortest', str(D/'crudo.mp4')]
r = sh(cmd)
print('armado:', 'OK' if r.returncode == 0 else 'FALLÓ')
if r.returncode: print(r.stderr[-1000:]); sys.exit(1)
print(f"velocidad x{1/F:.4f} | total {total:.1f}s | {len(pistas)-1} efectos colocados")
