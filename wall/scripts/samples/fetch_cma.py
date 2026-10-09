"""Cleveland Museum of Art open access (CC0): pick works per artist, download the print-size JPEG, size to 2400 px, keep the record."""
import json, sys, os, re, urllib.request, urllib.parse, subprocess, time
UA="LatentWall-samples/1.0 (https://latentstudios.com; developer@latentritual.com)"
ROOT=sys.argv[1]  # wall/design/samples
def get(u):
    for t in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":UA}), timeout=120))
        except Exception as e: time.sleep(2*(t+1)); err=e
    raise err
def fetch(u, out):
    if os.path.exists(out): return
    for t in range(3):
        try:
            data=urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":UA}), timeout=300).read(); break
        except Exception as e: time.sleep(3); err=e
    else: raise err
    tmp=out+".src"; open(tmp,"wb").write(data)
    subprocess.run(["sips","-s","format","jpeg","-s","formatOptions","86","-Z","2400",tmp,"--out",out],check=True,capture_output=True); os.remove(tmp)
def size(p):
    o=subprocess.run(["sips","-g","pixelWidth","-g","pixelHeight",p],capture_output=True,text=True).stdout.split(); return int(o[-3]), int(o[-1])
def works(q, key, limit=150):
    d=get("https://openaccess-api.clevelandart.org/api/artworks/?q="+urllib.parse.quote(q)+"&cc0=1&has_image=1&limit=%d"%limit)
    return [a for a in d["data"] if any(key in c.get("description","").lower() for c in a.get("creators",[])) and a.get("images",{}).get("print")]
def keep(a):
    cm=None
    m=re.search(r"(?:Unframed|Sheet|Image|Support|Overall|Plate|Framed)?:?\s*([\d.]+)\s*x\s*([\d.]+)(?:\s*x\s*[\d.]+)?\s*cm", a.get("measurements") or "")
    m2=re.search(r"Unframed:\s*([\d.]+)\s*x\s*([\d.]+)", a.get("measurements") or "") or re.search(r"(?:Sheet|Image):\s*([\d.]+)\s*x\s*([\d.]+)", a.get("measurements") or "") or m
    if m2: cm={"h":float(m2.group(1)),"w":float(m2.group(2))}  # museums give height x width
    return {"id":a["id"],"acc":a["accession_number"],"title":a["title"],"date":a.get("creation_date") or "","early":a.get("creation_date_earliest"),"type":a.get("type"),"technique":a.get("technique") or "","measurements":a.get("measurements") or "","cm":cm,"description":a.get("description") or "","wall":a.get("wall_description") or "","tombstone":a.get("tombstone") or "","credit":a.get("creditline") or "","url":a.get("url"),"creator":(a.get("creators") or [{}])[0].get("description",""),"bio":(a.get("creators") or [{}])[0].get("biography",""),"src":a["images"]["print"]["url"]}
plan={
 "redon": ("Odilon Redon","redon", lambda L: ([a for a in L if a["type"] in ("Painting",)] + [a for a in L if a["type"]=="Drawing" and "pastel" in (a.get("technique") or "").lower()] + [a for a in L if a["type"]=="Drawing" and "pastel" not in (a.get("technique") or "").lower()][:8] + [a for a in L if a["type"]=="Print"][:8])[:30]),
 "hiroshige": ("Hiroshige","hiroshige", lambda L: ([a for a in L if "Edo" in (a["title"] or "")][:14] + [a for a in L if "kaid" in (a["title"] or "")][:10] + [a for a in L if "Edo" not in (a["title"] or "") and "kaid" not in (a["title"] or "")][:8])[:30]),
 "atget": ("Atget","atget", lambda L: L[:16]),
 "palmer": ("Samuel Palmer","palmer", lambda L: ([a for a in L if a["type"] in ("Painting",)] + [a for a in L if a["type"]=="Drawing"][:12] + [a for a in L if a["type"]=="Print"][:10])[:26]),
}
for slug,(q,key,choose) in plan.items():
    if len(sys.argv)>2 and slug not in sys.argv[2:]: continue
    L=works(q,key); chosen=choose(L)
    os.makedirs(f"{ROOT}/{slug}/img", exist_ok=True); man=[]
    for a in chosen:
        k=keep(a); out=f"{ROOT}/{slug}/img/{k['acc'].replace('.','-')}.jpg"
        try: fetch(k["src"], out)
        except Exception as e: print("  skip", k["acc"], e); continue
        k["file"]=os.path.basename(out); k["w"],k["h"]=size(out); man.append(k); print(" ", slug, k["acc"], k["w"],"x",k["h"], k["type"], "|", k["title"][:50], "|", k["date"], flush=True)
    json.dump(man, open(f"{ROOT}/{slug}/manifest.json","w"), indent=1, ensure_ascii=False)
    print(slug, len(man), "works", flush=True)
