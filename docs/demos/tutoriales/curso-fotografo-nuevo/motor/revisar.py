# Un cuadro en el 70 % de cada toma, en una grilla, para comparar con la voz.
import sys, os, subprocess, montar
from clases import CLASES
for c in sys.argv[1:]:
    ws = montar.palabras(c); ini=[]; t=0
    for tm in CLASES[c]["tomas"]:
        t = 0.0 if not ini else max(0, montar.ancla(ws, tm["voz"], t) - 0.12); ini.append(t)
    ini.append(montar.dur(f"final/{c}.wav")); fs=[]
    for i in range(len(ini)-1):
        tt = montar.APERTURA + ini[i] + 0.7*(ini[i+1]-ini[i]); f=f"filmar/cuadros/r{i}.png"
        subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{tt:.2f}","-i",f"videos/{c}.mp4","-frames:v","1","-vf","scale=640:-1",f],check=True); fs.append(f)
    while len(fs)%3: fs.append(fs[-1])
    ins=sum([["-i",f] for f in fs],[]); n=len(fs)
    filas=";".join(f"[{3*r}][{3*r+1}][{3*r+2}]hstack=3[f{r}]" for r in range(n//3))
    fc=filas+(";"+"".join(f"[f{r}]" for r in range(n//3))+f"vstack={n//3}" if n//3>1 else "")
    if n//3==1: fc=fc.replace("[f0]","")
    subprocess.run(["ffmpeg","-v","error","-y",*ins,"-filter_complex",fc,f"filmar/cuadros/R-{c}.png"],check=True); print(c,"ok")
