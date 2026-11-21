# Corta limpio/Cxx.wav en grupos de sonido (separados por silencios) y transcribe cada grupo solo.
# Los grupos sin palabras (toses, carraspeos, «hum») se listan en ruido/Cxx.json para sacarlos.
import json, os, re, subprocess, sys, unicodedata
from ruidos import nosil
MODELO = "/Users/danielcuart/Herramientas/whisper-models/ggml-large-v3-turbo.bin"
RELLENO = {"hum","mmm","mm","eh","ah","uh","tos","ejem","hmm","um","gracias","ehm"}
def norm(s): return re.sub(r"[^a-zñ0-9 ]","",unicodedata.normalize("NFD",s.lower()).encode("ascii","ignore").decode()).split()
os.makedirs("ruido", exist_ok=True)
for c in sys.argv[1:]:
    tr = nosil(f"limpio/{c}.wav"); grupos=[]
    for a,b in tr:
        if grupos and a-grupos[-1][1] < 0.30: grupos[-1][1]=b
        else: grupos.append([a,b])
    d=f"ruido/{c}"; os.makedirs(d, exist_ok=True); fs=[]
    for i,(a,b) in enumerate(grupos):
        f=f"{d}/g{i:03d}.wav"; fs.append(f)
        subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{max(0,a-0.08):.3f}","-to",f"{b+0.08:.3f}","-i",f"limpio/{c}.wav","-ar","16000","-ac","1",
                        "-af","apad=pad_dur=0.6",f],check=True)
    args=[]; [args.extend(["-f",f]) for f in fs]
    subprocess.run(["whisper-cli","-m",MODELO,"-l","es","-nt","-otxt",*args],capture_output=True)
    full=[(x["offsets"]["from"]/1000, w) for x in json.load(open(f"txl/{c}.json"))["transcription"] for w in norm(x["text"])]
    res=[]
    for i,(a,b) in enumerate(grupos):
        t=open(fs[i]+".txt").read().strip() if os.path.exists(fs[i]+".txt") else ""
        ws=[w for w in norm(t) if w not in RELLENO]
        cerca={w for tt,w in full if a-3.5<=tt<=b+3.5}
        ok=sum(1 for w in ws if w in cerca)
        ruido = not ws or ok < max(1, 0.5*len(ws))
        res.append({"a":round(a,3),"b":round(b,3),"texto":t,"ruido":ruido})
    json.dump(res, open(f"ruido/{c}.json","w"), ensure_ascii=False, indent=0)
    print(c, len(grupos), "grupos ·", [(r["a"],r["b"],r["texto"]) for r in res if r["ruido"]])
