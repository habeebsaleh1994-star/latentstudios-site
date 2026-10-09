"""Wikimedia Commons: Lange (public domain, Library of Congress), HABS (public domain, US government), Blender open-movie posters and stills (CC BY). Sized to 2400 px."""
import json, sys, os, re, urllib.request, urllib.parse, subprocess, time
UA="LatentWall-samples/1.0 (https://latentstudios.com; developer@latentritual.com)"
ROOT, FETCH = sys.argv[1], sys.argv[2]
def get(u):
    for t in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":UA}), timeout=120))
        except Exception as e: time.sleep(2*(t+1)); err=e
    raise err
def info(title, width=2560):
    d=get("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=%d&format=json&titles=%s" % (width, urllib.parse.quote(title)))
    p=next(iter(d["query"]["pages"].values())); ii=p["imageinfo"][0]; em=ii.get("extmetadata",{})
    g=lambda k: re.sub(r"\s+"," ",re.sub("<[^>]+>","",em.get(k,{}).get("value",""))).strip()
    return {"title":p["title"],"w":ii["width"],"h":ii["height"],"mime":ii["mime"],"url":ii["url"].split("?")[0],"thumb":ii.get("thumburl"),"lic":g("LicenseShortName"),"artist":g("Artist"),"desc":g("ImageDescription"),"date":g("DateTimeOriginal"),"credit":g("Credit")}
def fetch(i, out):
    if os.path.exists(out): return
    u=i["thumb"] if (i["w"]>2560 or i["mime"]!="image/jpeg") and i.get("thumb") else i["url"]
    for t in range(3):
        try: data=urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":UA}), timeout=600).read(); break
        except Exception as e: time.sleep(4); err=e
    else: raise err
    tmp=out+".src"; open(tmp,"wb").write(data)
    subprocess.run(["sips","-s","format","jpeg","-s","formatOptions","86","-Z","2400",tmp,"--out",out],check=True,capture_output=True); os.remove(tmp)
def size(p):
    o=subprocess.run(["sips","-g","pixelWidth","-g","pixelHeight",p],capture_output=True,text=True).stdout.split(); return int(o[-3]), int(o[-1])
def slugify(s): return re.sub(r"-+","-",re.sub(r"[^a-z0-9]+","-",s.lower())).strip("-")[:60]
def body(slug, titles, name=lambda i,n: slugify(i["title"][5:])):
    os.makedirs(f"{ROOT}/{slug}/img", exist_ok=True); man=[]
    for n,t in enumerate(titles):
        try: i=info(t); out=f"{ROOT}/{slug}/img/{name(i,n)}.jpg"; fetch(i,out)
        except Exception as e: print("  skip", t[:60], e, flush=True); continue
        i["file"]=os.path.basename(out); i["pw"],i["ph"]=size(out); man.append(i); print(" ", slug, i["pw"],"x",i["ph"], "|", i["title"][5:70], "|", i["date"][:12], "|", i["lic"], flush=True)
    json.dump(man, open(f"{ROOT}/{slug}/manifest.json","w"), indent=1, ensure_ascii=False); print(slug, len(man), "works", flush=True)
which=sys.argv[3:] or ["lange","habs","films"]
if "lange" in which:
    L=json.load(open(f"{FETCH}/commons-lange.json"))
    bad=re.compile(r"detail|Dorothea Lange 1936|atop automobile|MET DP|restored|\(original\)|alternative|sequence|\(LOC fsa|Migrant agricultural worker's family|Depression kids|Poor mother and children|Street meeting|Boy, fourteen|Squatter camp", re.I)
    seen=set(); picks=[]
    for x in sorted(L, key=lambda x: x["date"]):
        if x["mime"]!="image/jpeg" or x["w"]<2500 or bad.search(x["title"]): continue
        k=re.sub(r"\W+","",x["desc"][:28].lower())
        if k in seen: continue
        seen.add(k); picks.append(x["title"])
    # thirty spread across the four years, Migrant Mother among them; short file names (an asset id is at most 80 characters)
    want=30; step=max(1,len(picks)/want); spread=[picks[int(i*step)] for i in range(want) if int(i*step)<len(picks)]
    mm=[t for t in picks if "MigrantMother02" in t]
    if mm and mm[0] not in spread: spread[len(spread)//2]=mm[0]
    short=lambda i,n: f"{n+1:02d}-"+slugify(re.sub(r"\.(jpg|tif)$","",i["title"][5:]))[:28].rstrip("-")
    body("lange", spread, name=short)
if "habs" in which:
    H=json.load(open(f"{FETCH}/commons-habs.json")); picks=[]
    for house,key in [("Farnsworth House HABS","farnsworth"),("Robie House HABS","robie"),("Gamble House HABS","gamble"),("Schindler House HABS","lovell-beach")]:
        items=H[house]; sheets=[x for x in items if re.search(r"sheet", x["title"]+x["desc"], re.I)]; photos=[x for x in items if x not in sheets and x["mime"]!="image/png"]
        if key=="lovell-beach": photos=[x for x in photos if "Lovell Beach" in x["title"]]
        # one file per original (Commons holds some twice, as tiff and png)
        def uniq(xs):
            out=[]; ks=set()
            for x in xs:
                k=re.sub(r"\.(tif|tiff|png|jpg)$","",x["title"].lower())
                if k not in ks: ks.add(k); out.append(x)
            return out
        photos, sheets = uniq(photos), uniq(sheets)
        for x in photos[:6]: picks.append((key, x["title"]))
        for x in sheets[:3]: picks.append((key, x["title"]))
    body("habs", [t for _,t in picks], name=lambda i,n: picks[n][0]+"-"+f"{n+1:02d}-"+slugify(i["title"][5:])[:22].rstrip("-"))
if "films" in which:
    F=json.load(open(f"{FETCH}/commons-films.json"))
    tos=[x["title"] for x in F["Tears of Steel screenshot"] if x["w"]==3840][:6]
    picks=["File:Sintel_poster.jpg","File:Peach_Bunny_Poster.jpg","File:Tos-poster.png","File:Blender_Foundation_-_Spring_-_Closing_title_card.jpg","File:Big_Buck_Bunny_-_forest.jpg","File:SpringOpenMovie-aplha.jpg","File:SpringOpenMovie-desend.jpg","File:SpringOpenMovie-final_scene.jpg"]+tos
    body("blender", picks)
