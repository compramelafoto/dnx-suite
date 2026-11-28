import json,sys,os
TX=os.environ.get("TX","txw")
c=sys.argv[1]; a=float(sys.argv[2]) if len(sys.argv)>2 else 0; b=float(sys.argv[3]) if len(sys.argv)>3 else 1e9
d=json.load(open(f"{TX}/{c}.json")); out=[]
for s in d["transcription"]:
    t=s["offsets"]["from"]/1000
    if a<=t<=b: out.append(f'{t:.2f}:{s["text"].strip()}')
print(" ".join(out))
