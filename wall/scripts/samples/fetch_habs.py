"""HABS on Commons: for each house, photographs (titled 'VIEW ... - House, address') and measured drawings ('(sheet n of m)'), matched by the house's own name. Public domain (US government)."""
import json, sys, os, re, urllib.request, urllib.parse, subprocess, time
UA="LatentWall-samples/1.0 (https://latentstudios.com; developer@latentritual.com)"
ROOT=sys.argv[1]
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
houses=[("farnsworth","Edith Farnsworth House",["Farnsworth House HABS","Edith Farnsworth House Plano"]),("robie","Frederick C. Robie House",["Robie House HABS","Frederick C. Robie House Chicago HABS"]),("gamble","Gamble House, 4 Westmoreland",["Gamble House Pasadena HABS","Gamble House 4 Westmoreland Place"]),("lovell-beach","Lovell Beach House",["Lovell Beach House HABS","Lovell Beach House Newport Beach"])]
os.makedirs(f"{ROOT}/habs/img", exist_ok=True); man=[]
for key,name,queries in houses:
    titles=[]
    for q in queries:
        d=get("https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=50&format=json&srsearch="+urllib.parse.quote(q))
        for h in d["query"]["search"]:
            if h["title"] not in titles and name.split(",")[0].lower() in h["title"].lower(): titles.append(h["title"])
    items=[]
    for t in titles:
        try: items.append(info(t))
        except Exception as e: print("  skip", t[:60], e)
    items=[x for x in items if x["mime"] in ("image/jpeg","image/tiff","image/png") and x["w"]>=1500 and "Public" in (x["lic"] or "")]
    seen=set(); uniq=[]
    for x in items:
        k=re.sub(r"\.(tif|tiff|png|jpg)$","",x["title"].lower())
        if k not in seen: seen.add(k); uniq.append(x)
    sheets=[x for x in uniq if re.search(r"sheet \d+ of \d+", x["title"]+x["desc"], re.I)]
    # a photograph is anything of the house that is not a sheet (the survey's own carry the survey number, 'HABS ILL,16-CHIG,33-12'); captioned ones first
    photos=[x for x in uniq if x not in sheets and x["mime"]!="image/png" and not re.search(r"drawing\.png", x["title"], re.I)]
    print("   not sheets:", [x["title"][5:60]+" "+x["mime"] for x in uniq if x not in sheets][:12], flush=True)
    photos.sort(key=lambda x: 0 if re.search(r"^File:[A-Z][A-Z ,.'()-]+ - ", x["title"]) else 1)
    print(key, len(uniq), "files;", len(photos), "photos,", len(sheets), "sheets", flush=True)
    for kind,xs,cap in (("photo",photos,6),("sheet",sheets,3)):
        n=0
        for x in xs[:cap]:
            n+=1; out=f"{ROOT}/habs/img/{key}-{kind[0]}{n}.jpg"
            try: fetch(x,out)
            except Exception as e: print("  skip", x["title"][:60], e, flush=True); continue
            x["file"]=os.path.basename(out); x["house"]=key; x["kind"]=kind; x["pw"],x["ph"]=size(out); man.append(x); print("  ", x["file"], x["pw"],"x",x["ph"], kind, "|", x["title"][5:80], flush=True)
json.dump(man, open(f"{ROOT}/habs/manifest.json","w"), indent=1, ensure_ascii=False); print("habs", len(man))
