"""Arma el video (sin audio) en tres tramos y los une.
Tramo 1: intro | Tramo 2: pantalla real + subtítulos | Tramo 3: escenas animadas."""
import json, subprocess, sys, pathlib
D = pathlib.Path(sys.argv[1])
plan = json.load(open(D/'plan.json'))
FPS = 25
f_intro = round(plan['intro'] * FPS)
f_prod = round(plan['producto'] * FPS)
total = plan['intro'] + plan['producto'] + sum(e['dur'] for e in plan['escenas'])
f_total = round(total * FPS)
V = ['-c:v','libx264','-crf','20','-preset','veryfast','-pix_fmt','yuv420p','-r','25']
FR = str(D/'frames-render'/'%05d.png')

tramos = [
  (['ffmpeg','-v','error','-y','-framerate','25','-start_number','0','-i',FR,'-frames:v',str(f_intro)] + V + [str(D/'tramo1.mp4')], 'intro'),
  (['ffmpeg','-v','error','-y','-i',str(D/'producto-listo.webm'),
    '-framerate','25','-start_number',str(f_intro),'-i',FR,
    '-filter_complex','[0:v]fps=25,format=rgba,setsar=1[b];[1:v]format=rgba[o];[b][o]overlay=shortest=1,format=yuv420p,setsar=1[v]',
    '-map','[v]','-frames:v',str(f_prod)] + V + [str(D/'tramo2.mp4')], 'pantalla real'),
  (['ffmpeg','-v','error','-y','-framerate','25','-start_number',str(f_intro+f_prod),'-i',FR,
    '-frames:v',str(f_total-f_intro-f_prod)] + V + [str(D/'tramo3.mp4')], 'escenas'),
]
for cmd, nombre in tramos:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(f'{nombre}: FALLÓ\n{r.stderr[-500:]}'); sys.exit(1)
    d = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',cmd[-1]],
                       capture_output=True, text=True).stdout.strip()
    print(f'  {nombre}: {d}s')

lista = D/'tramos.txt'
lista.write_text(''.join(f"file '{D}/tramo{i}.mp4'\n" for i in (1,2,3)))
r = subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(lista),
                    '-c','copy', str(D/'solo-video.mp4')], capture_output=True, text=True)
print('unión:', 'OK' if r.returncode == 0 else r.stderr[-400:])
d = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(D/'solo-video.mp4')],
                   capture_output=True, text=True).stdout.strip()
print(f'video completo: {d}s (esperado {total:.2f}s)')
