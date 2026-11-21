# Tercera pasada: saca de limpio/Cxx.wav los tramos sin palabras reales y sin tono de voz (toses, carraspeos).
# Resultado en final/Cxx.wav. Necesita ruido/Cxx.json (ruidos2.py) y numpy.
import json, os, subprocess, sys, wave, numpy as np
exec(open("tono.py").read().split("for c in sys.argv")[0])
os.makedirs("final", exist_ok=True)
for c in sys.argv[1:]:
    subprocess.run(["ffmpeg","-v","error","-y","-i",f"limpio/{c}.wav","-ar","16000","-ac","1",f"wav16/{c}.wav"],check=True)
    x, sr = leer(f"wav16/{c}.wav"); fuera = []
    for r in json.load(open(f"ruido/{c}.json")):
        if not r["ruido"]: continue
        fv, _ = voz(x[int(r["a"]*sr):int(r["b"]*sr)], sr)
        if fv < 0.45: fuera.append((max(0, r["a"]-0.04), r["b"]+0.04))
    D = len(x)/sr; keep = []; t = 0
    for a, b in fuera:
        if a > t: keep.append((t, a))
        t = b
    keep.append((t, D)); keep = [(a, b) for a, b in keep if b-a > 0.03]
    parts = "".join(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st={max(0,b-a-0.015):.3f}:d=0.015[p{i}];" for i,(a,b) in enumerate(keep))
    fc = parts + "".join(f"[p{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=0:a=1[o]"
    subprocess.run(["ffmpeg","-v","error","-y","-i",f"limpio/{c}.wav","-filter_complex",fc,"-map","[o]",f"final/{c}.wav"],check=True)
    print(c, "saqué", [(round(a,2), round(b,2)) for a,b in fuera])
