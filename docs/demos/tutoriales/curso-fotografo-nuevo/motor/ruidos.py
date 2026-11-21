# Busca tramos con sonido donde el transcriptor no encontró palabras (toses, carraspeos, respiraciones) en limpio/Cxx.wav.
import json, subprocess, sys, os
def nosil(f):
    out = subprocess.run(["ffmpeg","-i",f,"-af","silencedetect=noise=-36dB:d=0.12","-f","null","-"],capture_output=True,text=True).stderr
    ev=[]; 
    for l in out.splitlines():
        if "silence_start" in l: ev.append(("S",float(l.split("silence_start:")[1].split()[0])))
        if "silence_end" in l: ev.append(("E",float(l.split("silence_end:")[1].split("|")[0])))
    D=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]))
    tramos=[]; t=0.0
    for k,v in ev:
        if k=="S": 
            if v>t+0.02: tramos.append((t,v))
        else: t=v
    if D>t+0.02: tramos.append((t,D))
    return tramos
def candidatos(c):
    ws=[s["offsets"]["from"]/1000 for s in json.load(open(f"txl/{c}.json"))["transcription"] if s["text"].strip()]
    res=[]
    for a,b in nosil(f"limpio/{c}.wav"):
        if b-a>1.6: continue
        if not any(a-0.6<=w<=b+0.25 for w in ws): res.append((a,b))
    return res
if __name__=="__main__":
    for c in sys.argv[1:]:
        print(c, [(round(a,2),round(b,2)) for a,b in candidatos(c)])
