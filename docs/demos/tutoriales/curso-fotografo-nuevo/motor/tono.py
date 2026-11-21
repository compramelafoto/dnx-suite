# Mide en cada tramo marcado qué parte del tiempo tiene «tono de voz» (autocorrelación alta entre 80 y 300 Hz).
import json, sys, wave, numpy as np
def leer(f):
    w = wave.open(f); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float); return x / 32768, w.getframerate()
def voz(x, sr):
    fr = int(0.03*sr); hop = int(0.01*sr); n = 0; v = 0
    for i in range(0, len(x)-fr, hop):
        s = x[i:i+fr]; e = np.sqrt((s**2).mean())
        if e < 0.01: continue
        n += 1; s = s - s.mean(); ac = np.correlate(s, s, "full")[fr-1:]; ac /= ac[0] + 1e-9
        lo, hi = int(sr/300), int(sr/80)
        if ac[lo:hi].max() > 0.5: v += 1
    return v / max(n, 1), n
for c in sys.argv[1:]:
    x, sr = leer(f"wav16/{c}.wav")
    for r in json.load(open(f"ruido/{c}.json")):
        a, b = r["a"], r["b"]; seg = x[int(a*sr):int(b*sr)]; fv, n = voz(seg, sr)
        if r["ruido"] or c == "CAL": print(c, a, b, round(b-a, 2), "voz=%.2f" % fv, "marcado" if r["ruido"] else "habla", r["texto"][:30])
