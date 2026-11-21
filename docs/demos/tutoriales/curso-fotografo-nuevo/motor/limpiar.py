# Saca las tomas repetidas (CORTES) y acorta los silencios largos. Resultado: limpio/Cxx.wav (48 kHz) normalizado.
import subprocess, json
CORTES = {"C01": [(16.84, 30.09), (81.56, 103.15)], "C02": [(36.94, 63.42)], "C03": [(37.49, 44.39)],
          "C06": [(51.44, 76.47), (87.62, 130.10)]}
MAX_SIL, DEJA = 0.65, 0.42
def dur(f): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]))
def sil(c):
    L=open(f"sil/{c}.txt").read().split(); return [(float(L[i+1]),float(L[i+3])) for i in range(0,len(L)-3,4)]
import os; os.makedirs("limpio", exist_ok=True)
for n in range(1, 11):
    c=f"C{n:02d}"; D=dur(f"audios/{c}.m4a")
    quitar=list(CORTES.get(c, []))
    for s,e in sil(c):
        if e-s > MAX_SIL: quitar.append((s+DEJA/2, e-DEJA/2))
    if sil(c) and sil(c)[0][0] < 0.05: quitar.append((0, max(0, sil(c)[0][1]-0.25)))
    quitar.sort(); merged=[]
    for a,b in quitar:
        if merged and a<=merged[-1][1]: merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
        else: merged.append((a,b))
    keep=[]; t=0
    for a,b in merged:
        if a>t: keep.append((t,a))
        t=max(t,b)
    if t<D: keep.append((t,D))
    keep=[(a,b) for a,b in keep if b-a>0.05]
    parts="".join(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={b-a-0.02:.3f}:d=0.02[p{i}];" for i,(a,b) in enumerate(keep))
    fc=parts+"".join(f"[p{i}]" for i in range(len(keep)))+f"concat=n={len(keep)}:v=0:a=1,highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[o]"
    subprocess.run(["ffmpeg","-v","error","-y","-i",f"audios/{c}.m4a","-filter_complex",fc,"-map","[o]","-ac","1",f"limpio/{c}.wav"],check=True)
    print(c, f"{D:.1f}s →", f"{dur(f'limpio/{c}.wav'):.1f}s")

# Segunda pasada: repeticiones que aparecieron al transcribir palabra por palabra (tiempos del audio ya limpio).
POSTCORTES = {"C09": [(31.75, 36.67)], "C10": [(22.82, 26.69)]}
for c, cortes in POSTCORTES.items():
    (a, b), = cortes
    fc = f"[0:a]atrim=0:{a},asetpts=PTS-STARTPTS[x];[0:a]atrim={b},asetpts=PTS-STARTPTS[y];[x][y]concat=n=2:v=0:a=1[o]"
    subprocess.run(["ffmpeg","-v","error","-y","-i",f"limpio/{c}.wav","-filter_complex",fc,"-map","[o]",f"limpio/{c}-b.wav"],check=True)
    os.replace(f"limpio/{c}-b.wav", f"limpio/{c}.wav"); print(c, "segunda pasada →", f"{dur(f'limpio/{c}.wav'):.1f}s")
