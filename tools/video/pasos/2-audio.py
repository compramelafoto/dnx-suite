"""Genera música y efectos, y verifica que no salgan mudos (la API a veces devuelve casi silencio)."""
import json, os, re, subprocess, sys, pathlib
D = pathlib.Path(sys.argv[1]); key = os.environ['ELEVENLABS_API_KEY']
A = D/'audio'

def pico(f):
    s = subprocess.run(['ffmpeg','-hide_banner','-i',str(f),'-af','volumedetect','-f','null','-'],
                       capture_output=True, text=True).stderr
    m = re.search(r'max_volume:\s+(-?\d+\.\d+) dB', s)
    return float(m.group(1)) if m else -99.0

def sfx(nombre, prompts, seg):
    for intento, p in enumerate(prompts, 1):
        out = A/f'sfx-{nombre}.mp3'
        subprocess.run(["curl","-s","-o",str(out),"-X","POST","https://api.elevenlabs.io/v1/sound-generation",
            "-H",f"xi-api-key: {key}","-H","Content-Type: application/json",
            "-d", json.dumps({"text": p, "duration_seconds": seg, "prompt_influence": 0.8})], capture_output=True)
        pk = pico(out)
        if pk > -25:
            print(f"  {nombre:<10} pico {pk:6.1f} dB  (intento {intento})"); return
        print(f"  {nombre:<10} pico {pk:6.1f} dB — muy bajo, reintento")
    print(f"  {nombre:<10} NO SE PUDO generar con nivel usable")

EFECTOS = {
  'sting':    (["short bright brand logo sting, upbeat airy whoosh into a clean bell chime, positive"], 2.2),
  'copiar':   (["single crisp UI click, copy to clipboard tap, clean and short"], 0.5),
  'enviar':   (["message sent notification, short whoosh swipe, light and modern"], 0.8),
  'moneda':   (["coin drop, single bright metallic coin landing, crisp and short"], 0.9),
  'acredita': (["positive money received notification, warm bright two note chime, banking app"], 1.4),
  'contador': (["fast rising ticking counter, numbers rolling up, short mechanical ratchet"], 1.6),
  'aviso':    (["soft warning notification, gentle low double beep, not alarming"], 1.0),
  'outro':    (["warm bright chime resolve, short positive brand outro"], 2.0),
}
print('efectos:')
for k, (ps, s) in EFECTOS.items(): sfx(k, ps, s)

print('música:')
out = A/'musica.mp3'
subprocess.run(["curl","-s","-o",str(out),"-X","POST","https://api.elevenlabs.io/v1/music",
    "-H",f"xi-api-key: {key}","-H","Content-Type: application/json",
    "-d", json.dumps({"prompt": "Upbeat optimistic corporate background music, light plucky synth and soft claps, "
                                "modern and motivating, steady mid tempo, positive business explainer, no vocals, "
                                "leaves room for a voiceover on top, clean loop",
                      "music_length_ms": 76000})], capture_output=True)
dur = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(out)],
                     capture_output=True, text=True).stdout.strip()
print(f"  musica    {float(dur):.1f}s  pico {pico(out):.1f} dB")
