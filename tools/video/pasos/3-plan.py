"""Plan de escenas derivado de la voz. Las escenas 'X' y 'X2' comparten un mismo clip."""
import json, sys, pathlib, re
D = pathlib.Path(sys.argv[1])
tv = json.load(open(D/'tiempos-voz.json')); g = json.load(open(D/'guion.json'))
f = {x['escena']: x for x in tv['frases']}
INTRO, LEAD, COLA = 2.5, 0.25, 2.8
orden = [x['escena'] for x in tv['frases']]
esc = []
for i, k in enumerate(orden):
    fin = f[orden[i+1]]['inicio'] if i + 1 < len(orden) else f[k]['fin'] + COLA
    esc.append({"id": k, "dur": round(fin - f[k]['inicio'], 2)})
# fusionar X2 dentro de X
fusion = []
for e in esc:
    base = re.sub(r'2$', '', e['id'])
    if fusion and fusion[-1]['id'] == base:
        fusion[-1]['dur'] = round(fusion[-1]['dur'] + e['dur'], 2)
    else:
        fusion.append({"id": base, "dur": e['dur']})
pantalla = g.get('pantallaEscena')
plan = {"intro": INTRO, "vozOffset": INTRO + LEAD, "escenas": fusion}
if pantalla:
    plan["producto"] = next(e['dur'] for e in fusion if e['id'] == pantalla)
    plan["pantallaEscena"] = pantalla
json.dump(plan, open(D/'plan.json','w'), indent=1)
total = INTRO + sum(e['dur'] for e in fusion)
print(f"total {total:.1f}s ({total/60:.1f} min)")
t = INTRO
for e in fusion:
    print(f"  {e['id']:<13} {t:6.1f}s  ({e['dur']}s)"); t += e['dur']
