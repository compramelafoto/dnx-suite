"""Corta la locución continua en frases e intercala silencio, para que un tutorial respire.
La entonación no se toca: cada frase conserva su grabación original."""
import json, subprocess, sys, pathlib
D = pathlib.Path(sys.argv[1]); A = D/'audio'
g = json.load(open(D/'guion.json')); tv = json.load(open(D/'tiempos-voz.json'))
P = float(g.get('pausaEntreFrases', 0.8))
fr = tv['frases']
dur = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',
                            str(A/'voz.mp3')], capture_output=True, text=True).stdout)
# límites: mitad del silencio entre frase y frase
lim = [0.0] + [round((fr[i]['fin'] + fr[i+1]['inicio']) / 2, 3) for i in range(len(fr) - 1)] + [round(dur, 3)]
(A/'frases').mkdir(exist_ok=True)
partes = []
for i in range(len(fr)):
    out = A/'frases'/f"{i:02d}-{fr[i]['escena']}.mp3"
    subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{lim[i]:.3f}','-to',f'{lim[i+1]:.3f}',
                    '-i',str(A/'voz.mp3'),'-c:a','libmp3lame','-q:a','2',str(out)], check=True)
    partes.append(out)
# audio completo con pausas (por si se quiere escuchar suelto)
lista = D/'concat.txt'
sil = A/'silencio.mp3'
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',f'anullsrc=r=44100:cl=mono','-t',str(P),
                '-c:a','libmp3lame','-q:a','2',str(sil)], check=True)
with open(lista,'w') as fh:
    for i, p in enumerate(partes):
        if i: fh.write(f"file '{sil}'\n")
        fh.write(f"file '{p}'\n")
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(lista),
                '-c:a','libmp3lame','-q:a','2',str(A/'voz-pausada.mp3')], check=True)
# tiempos nuevos: cada frase se corre P segundos por cada frase anterior
nuevo = {"total": None, "frases": [], "palabras": [], "pausa": P, "cortes": lim}
for i, f in enumerate(fr):
    d = i * P
    nuevo['frases'].append({**f, "inicio": round(f['inicio'] + d, 3), "fin": round(f['fin'] + d, 3),
                            "archivo": str(partes[i].name), "enFrase": round(f['inicio'] - lim[i], 3)})
for p in tv['palabras']:
    i = max(j for j in range(len(fr)) if p['t'] >= lim[j])
    nuevo['palabras'].append({**p, "t": round(p['t'] + i * P, 3), "f": round(p['f'] + i * P, 3)})
nuevo['total'] = round(dur + (len(fr) - 1) * P, 3)
json.dump(nuevo, open(D/'tiempos-voz.json','w'), indent=1, ensure_ascii=False)
print(f"{len(partes)} frases separadas · pausa de {P}s · duración {dur:.1f}s → {nuevo['total']:.1f}s")
