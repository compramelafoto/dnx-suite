"""Genera la locución en UNA sola lectura continua y devuelve los tiempos de cada frase y cada palabra."""
import base64, json, os, re, subprocess, sys, pathlib
D = pathlib.Path(sys.argv[1])
key = os.environ['ELEVENLABS_API_KEY']
g = json.load(open(D/'guion.json'))
# Palabra de descarte: el modelo deforma la primera palabra de cada generación.
# La generamos, la ubicamos con los tiempos que devuelve la API y la cortamos.
DESCARTE = "Bueno."
cuerpo = '\n\n'.join(f['texto'] for f in g['frases'])   # párrafo por frase: obliga a cerrar la entonación
texto = DESCARTE + '\n\n' + cuerpo
r = subprocess.run(["curl","-s","-X","POST",
    f"https://api.elevenlabs.io/v1/text-to-speech/{g['voz']}/with-timestamps?output_format=mp3_44100_128",
    "-H", f"xi-api-key: {key}", "-H","Content-Type: application/json",
    "-d", json.dumps({"text": texto, "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.62, "similarity_boost": 0.85, "style": 0.08, "use_speaker_boost": True}})],
    capture_output=True, text=True)
d = json.loads(r.stdout)
if 'audio_base64' not in d:
    print('ERROR de la API:', str(d)[:400]); sys.exit(1)
open(D/'audio'/'voz-cruda.mp3','wb').write(base64.b64decode(d['audio_base64']))
al = d['alignment']; ini, fin = al['character_start_times_seconds'], al['character_end_times_seconds']
# recortar la palabra de descarte
i0 = texto.index(g['frases'][0]['texto'])
# Corte: apenas después de que termina el descarte, sin comerse la primera palabra.
# Cuando el modelo no deja pausa (hueco < 0.1s), pegarse a ini[i0]-0.06 dejaba un resto audible.
fin_descarte = fin[len(DESCARTE) - 1]
corte = max(0.0, min(ini[i0] - 0.02, fin_descarte + 0.005))
hueco = ini[i0] - fin[len(DESCARTE) - 1]
print(f"descarte: se corta en {corte:.2f}s (silencio de {hueco:.2f}s antes de la primera palabra)")
if hueco < 0.06: print("  AVISO: hueco muy chico; se corta pegado al descarte")
subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{corte:.3f}','-i',str(D/'audio'/'voz-cruda.mp3'),
                '-c:a','libmp3lame','-q:a','2', str(D/'audio'/'voz.mp3')], check=True)
ini = [t - corte for t in ini]; fin = [t - corte for t in fin]
frases, cur = [], 0
for f in g['frases']:
    i = texto.index(f['texto'], cur); j = i + len(f['texto']) - 1; cur = j
    frases.append({"escena": f['escena'], "inicio": round(ini[i],3), "fin": round(fin[j],3)})
palabras = [{"w": m.group(), "t": round(ini[m.start()],3), "f": round(fin[m.end()-1],3)}
            for m in re.finditer(r'\S+', texto) if m.start() >= i0]   # sin la palabra de descarte
json.dump({"total": round(fin[-1],3), "frases": frases, "palabras": palabras},
          open(D/'tiempos-voz.json','w'), indent=1, ensure_ascii=False)
print(f"locución: {fin[-1]:.1f}s | {len(palabras)} palabras")
for t in frases: print(f"  {t['escena']:<11} {t['inicio']:6.2f} → {t['fin']:6.2f}")
