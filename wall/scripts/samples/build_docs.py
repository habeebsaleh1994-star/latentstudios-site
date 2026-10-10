"""Writes the sample site documents (version 15) from the fetched bodies of work. Run: python3 -I build_docs.py <wall> <fetch> [bodies...]"""
import json, sys, os, re, subprocess
WALL, FETCH = sys.argv[1], sys.argv[2]
ROOT = f"{WALL}/design/samples"
def size(p):
    o=subprocess.run(["sips","-g","pixelWidth","-g","pixelHeight",p],capture_output=True,text=True).stdout.split(); return int(o[-3]), int(o[-1])
def slug(s): return re.sub(r"-+","-",re.sub(r"[^a-z0-9]+","-",s.lower())).strip("-")[:48] or "page"
def theme(look="quiet", **kw):
    t={"look":look,"options":{},"palette":"silk","mode":"system","accent":None,"type":"silk","mount":"bare","space":"standard","motion":"slow","read":"standard"}; t.update(kw); return t
def work(asset, title, date="", caption="", alt="", place="", line="", edition="", made="", cm=None, kind="image", wh=None):
    w,h = wh or size(f"{WALL}{asset}")
    return {"kind":kind,"w":w,"h":h,"title":title[:200],"date":date[:40],"caption":caption[:200],"alt":(alt or title)[:200],"focal":{"x":50,"y":50},"size":({"w":round(cm["w"],1),"h":round(cm["h"],1)} if cm else None),"verso":{"place":place[:200],"line":line[:1000],"edition":edition[:200],"made":made[:1000]}}
def piece(asset, arrange="alone", note="", full=False): return {"type":"work","asset":asset,"arrange":arrange,"note":note[:200],"full":full}
def pause(text, label=""): return {"type":"pause","label":label[:200],"text":text[:5000]}
def story(id, title, pieces, titleEm="", kicker="", note="", arrangement="held"): return {"id":id,"kind":"story","title":title,"titleEm":titleEm,"inNav":True,"kicker":kicker,"note":note,"arrangement":arrangement,"pieces":pieces}
def writing(id, title, paras, titleEm="", form="", place="", year="", margin="", image=None): return {"id":id,"kind":"writing","title":title,"titleEm":titleEm,"inNav":True,"form":form,"place":place,"year":year,"paras":paras,"margin":margin,"image":image}
def film(id, title, titleEm="", **kw):
    p={"id":id,"kind":"film","title":title,"titleEm":titleEm,"inNav":True,"form":"","year":"","runtime":"","ratio":"","synopsis":"","poster":None,"video":None,"link":"","stills":[],"credits":[]}; p.update(kw); return p
def project(id, title, titleEm="", **kw):
    p={"id":id,"kind":"project","title":title,"titleEm":titleEm,"inNav":True,"discipline":"","client":"","year":"","summary":"","outcome":[],"process":[],"compare":False,"facts":[]}; p.update(kw); return p
def about(paras, principles=[]): return {"id":"about","kind":"about","title":"About","inNav":True,"paras":paras,"principles":principles}
def contact(paras): return {"id":"contact","kind":"contact","title":"Contact","inNav":True,"paras":paras}
def record(paras, sections): return {"id":"record","kind":"record","title":"Record","inNav":True,"paras":paras,"sections":[{"title":t,"entries":[{"year":y,"text":x} for y,x in e]} for t,e in sections]}
def site(house, name, front, library, pages, look="quiet", contact_line="", **kw):
    d={"version":15,"house":house,"name":name,"contact":contact_line,"email":"","front":front,"theme":theme(look),"library":library,"pages":pages}; d.update(kw); return d
def front(form, kicker, title, titleEm="", note=""): return {"form":form,"kicker":kicker,"title":title,"titleEm":titleEm,"note":note}
def save(slugname, doc):
    os.makedirs(ROOT, exist_ok=True); p=f"{ROOT}/{slugname}.site.json"; json.dump(doc, open(p,"w"), indent=1, ensure_ascii=False)
    print("wrote", p, len(doc["library"]), "works,", len(doc["pages"]), "pages")
def manifest(slugname): return json.load(open(f"{ROOT}/{slugname}/manifest.json"))
def read(slugname): return [b for b in sys.argv[3:]] == [] or slugname in sys.argv[3:]

# ---------------------------------------------------------------- Blender Studio: four open movies (CC BY)
if read("blender"):
    B="/design/samples/blender"; lib={}
    M={m["title"][5:]: m for m in manifest("blender")}
    def commons(name, title, date, caption, alt, line, made):
        m=M[name]; a=f"{B}/img/{m['file']}"; lib[a]=work(a,title,date,caption,alt,place="Blender Studio, Amsterdam",line=line,made=made); return a
    def still(file, title, date, caption, alt, made):
        a=f"{B}/img/{file}"; lib[a]=work(a,title,date,caption,alt,place="Blender Studio, Amsterdam",made=made); return a
    cc3="© Blender Foundation · CC BY 3.0"; cc4="© Blender Foundation · CC BY 4.0"
    # posters
    pS=commons("Sintel poster.jpg","Sintel, poster","2010","Theatrical poster","Poster for Sintel: a young woman with red hair stands before a mountain, a small dragon at her feet",cc3,"Durian open movie project")
    pB=commons("Peach Bunny Poster.jpg","Big Buck Bunny, poster","2008","Theatrical poster","Poster for Big Buck Bunny: a large white rabbit beams in a sunlit meadow",cc3,"Peach open movie project")
    pT=commons("Tos-poster.png","Tears of Steel, poster","2012","Theatrical poster","Poster for Tears of Steel: a lone figure before a vast robotic hand over a ruined Amsterdam",cc3,"Mango open movie project")
    pP=commons("Blender Foundation - Spring - Closing title card.jpg","Spring, title card","2019","Closing title card","Title card for Spring: a shepherd girl and her dog on a mountain pass under a wide sky",cc4,"Spring open movie project")
    # stills
    sS=[still(f"sintel-still-{t}.jpg",f"Sintel, {c}","2010","Still","Still from Sintel: "+c, cc3) for t,c in [(6,"the mountain pass"),(14,"Sintel"),(20,"the city"),(27,"at dusk"),(34,"the dragon"),(38,"the desert")]]
    sB=[still(f"bbb-still-{t}.jpg",f"Big Buck Bunny, {c}","2008","Still","Still from Big Buck Bunny: "+c, cc3) for t,c in [(4,"the burrow"),(9,"the meadow"),(13,"three rodents"),(16,"Bunny"),(20,"the plan"),(25,"the butterfly")]]
    sT=[commons(n,f"Tears of Steel, {c}","2012","Still","Still from Tears of Steel: "+c,cc3,"Mango open movie project") for n,c in zip([k for k in M if k.startswith("Tears of Steel frame")][:6],["the launch site","the bridge","the lab","Amsterdam","the attack","the rooftops"])]
    sP=[commons(n,f"Spring, {c}","2019","Still","Still from Spring: "+c,"© Blender Foundation · CC BY-SA 4.0","Spring open movie project") for n,c in [("SpringOpenMovie-aplha.jpg","the spirit"),("SpringOpenMovie-desend.jpg","over the clouds"),("SpringOpenMovie-final scene.jpg","the valley")]]
    forest=commons("Big Buck Bunny - forest.jpg","Big Buck Bunny, the forest","2008","Still","Still from Big Buck Bunny: the forest floor in morning light",cc3,"Peach open movie project")
    vids={}
    for f,t in [("sintel-clip.mp4","Sintel, excerpt"),("bbb-clip.mp4","Big Buck Bunny, excerpt"),("tos-clip.mp4","Tears of Steel, excerpt"),("spring-clip.mp4","Spring, excerpt")]:
        a=f"{B}/media/{f}"; o=subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0",f"{WALL}{a}"],capture_output=True,text=True).stdout.strip().split(","); lib[a]=work(a,t,"","A twenty second excerpt",t,kind="video",wh=(int(o[0]),int(o[1]))); vids[f]=a
    pages=[
      film("sintel","Sintel",form="Short film",year="2010",runtime="14 min",ratio="2.35:1",synopsis="A lonely young woman, Sintel, helps and befriends a dragon she calls Scales. When he is kidnapped by an adult dragon, she undertakes a journey to find him, and finds, at the end of it, something she did not expect. The third open movie, made in Amsterdam by the Durian team.",poster=pS,video=vids["sintel-clip.mp4"],link="https://durian.blender.org",stills=[{"asset":a,"caption":c} for a,c in zip(sS,["The pass, in snow","Sintel","The city","Dusk","Scales","The desert"])],credits=["Directed by Colin Levy","Produced by Ton Roosendaal, Blender Foundation","Screenplay by Esther Wouda","Music by Jan Morgenstern","© Blender Foundation, durian.blender.org · CC BY 3.0"]),
      film("big-buck-bunny","Big Buck",titleEm="Bunny",form="Short film",year="2008",runtime="10 min",ratio="16:9",synopsis="A giant rabbit with a heart bigger than himself wakes to a spring morning. Three rodents torment him and the butterflies he loves, and he plans, with care, a payback. The first open movie made with a studio and a team, in Amsterdam.",poster=pB,video=vids["bbb-clip.mp4"],link="https://peach.blender.org",stills=[{"asset":a,"caption":c} for a,c in zip(sB+[forest],["The burrow","The meadow","Three rodents","Bunny","The plan","The butterfly","The forest"])],credits=["Directed by Sacha Goedegebure","Produced by Ton Roosendaal, Blender Foundation","Music by Jan Morgenstern","© Blender Foundation, peach.blender.org · CC BY 3.0"]),
      film("tears-of-steel","Tears of",titleEm="Steel",form="Short film",year="2012",runtime="12 min",ratio="2.40:1",synopsis="In a future Amsterdam, a group of warriors and scientists gather at the Oude Kerk to stage a crucial event from the past, in a desperate attempt to rescue the world from destructive robots. Live action and computer graphics, made to test Blender's tools for film.",poster=pT,video=vids["tos-clip.mp4"],link="https://mango.blender.org",stills=[{"asset":a,"caption":c} for a,c in zip(sT,["The launch site","The bridge","The lab","Amsterdam","The attack","On the rooftops"])],credits=["Directed by Ian Hubert","Produced by Ton Roosendaal, Blender Foundation","Music by Joram Letwory","© Blender Foundation, mango.blender.org · CC BY 3.0"]),
      film("spring","Spring",form="Short film",year="2019",runtime="8 min",ratio="2.39:1",synopsis="A shepherd girl and her dog face ancient spirits to continue the cycle of life. Painted light, a mountain, and a wide sky; the open movie that tested Blender 2.8.",poster=sP[2],video=vids["spring-clip.mp4"],link="https://studio.blender.org/films/spring/",stills=[{"asset":a,"caption":c} for a,c in zip(sP[:2]+[pP],["The spirit","Over the clouds","The title"])],credits=["Directed by Andy Goralczyk","Produced by Francesco Siddi, Blender Animation Studio","Music by Torin Borrowdale","© Blender Foundation, studio.blender.org · CC BY 4.0"]),
      about(["Blender Studio is the film team of the Blender Foundation, in Amsterdam. Since 2006 it has made short films in the open: the films, and everything that went into making them, are released under Creative Commons licences for anyone to watch, study and reuse.","This is a sample site built from four of those films. The films and their stills are © Blender Foundation, used under CC BY; the words here are the sample's own."]),
      record(["The open movies, in order."],[("Films",[("2006","Elephants Dream, the first open movie"),("2008","Big Buck Bunny"),("2010","Sintel"),("2012","Tears of Steel"),("2015","Cosmos Laundromat"),("2019","Spring")])]),
      contact(["A sample site. The films are by Blender Foundation and its studio, studio.blender.org, and are used here under their Creative Commons licences.","Latent Wall shows them to show what a filmmaker's site can be."]),
    ]
    save("blender", site("reel","Blender Studio",front("posters","Open movies · Amsterdam · 2008 – 2019","Four",titleEm="films",note="Short films made in the open, with everything that went into them given away."),lib,pages,look="cinema",contact_line="Films © Blender Foundation, CC BY"))

# ---------------------------------------------------------------- Emily Dickinson (public domain)
if read("dickinson"):
    W=json.load(open(f"{FETCH}/writers.json")); pages=[]
    for p in W["dickinson"]:
        t=p["title"] or p["first"]; id=slug(t)
        pages.append(writing(id, t, ["\n\n".join(p["stanzas"])], form="Poem", place="Amherst", year="", margin=("" if p["title"] else "untitled")))
    pages+= [about(["Emily Dickinson wrote nearly eighteen hundred poems, and published almost none of them in her lifetime. They were found in her room after her death in 1886, sewn into small booklets, and first printed in 1890.","This is a sample site: the poems are from the first three series, edited by Mabel Loomis Todd and Thomas Wentworth Higginson (1890 – 1896), as kept by Project Gutenberg. The poems are in the public domain; the words about them are the sample's own."]),
             record(["A life, briefly."],[("Life",[("1830","Born in Amherst, Massachusetts, 10 December"),("1847","A year at Mount Holyoke Female Seminary"),("1858","Begins to gather her poems into hand-sewn booklets"),("1862","Writes to Thomas Wentworth Higginson, asking whether her verse is alive"),("1886","Dies at the Homestead, Amherst, 15 May")]),("Publication",[("1890","Poems, first series, edited by Todd and Higginson"),("1891","Poems, second series"),("1896","Poems, third series"),("1955","The complete poems, in Johnson's edition")])]),
             contact(["A sample site. The texts are in the public domain, from Project Gutenberg.","Latent Wall shows them to show what a poet's site can be."])]
    save("dickinson", site("chapbook","Emily Dickinson",front("reading","Poems · Amherst · 1890 – 1896","Twenty-one",titleEm="poems",note="From the three series her friends printed after her death."),{},pages,look="typewriter",contact_line="Poems in the public domain"))

# ---------------------------------------------------------------- Virginia Woolf (public domain)
if read("woolf"):
    W=json.load(open(f"{FETCH}/writers.json")); pages=[]
    forms={"A Haunted House":"Sketch","A Society":"Story","Monday Or Tuesday":"Sketch","An Unwritten Novel":"Story","The String Quartet":"Sketch","Blue & Green":"Sketch","Kew Gardens":"Story","The Mark On The Wall":"Story"}
    for p in W["woolf"]:
        t=p["title"].replace(" Or "," or ").replace(" On The "," on the "); pages.append(writing(slug(t), t, p["paras"], form=forms[p["title"]], place="London", year="1921"))
    pages+= [about(["Virginia Woolf published Monday or Tuesday in 1921 at the Hogarth Press, the press she and Leonard Woolf ran from their house in Richmond. Eight short pieces: some stories, some sketches, each an experiment in how a mind moves.","This is a sample site: the texts are from the 1921 edition as kept by Project Gutenberg, in the public domain. The words about them are the sample's own."]),
             record(["A life, briefly."],[("Life",[("1882","Born Adeline Virginia Stephen in London, 25 January"),("1904","Moves to Gordon Square, Bloomsbury"),("1912","Marries Leonard Woolf"),("1917","Founds the Hogarth Press with Leonard Woolf"),("1941","Dies at Rodmell, Sussex, 28 March")]),("Books",[("1915","The Voyage Out"),("1921","Monday or Tuesday"),("1925","Mrs Dalloway"),("1927","To the Lighthouse"),("1929","A Room of One's Own"),("1931","The Waves")])]),
             contact(["A sample site. The texts are in the public domain, from Project Gutenberg.","Latent Wall shows them to show what an essayist's site can be."])]
    save("woolf", site("column","Virginia Woolf",front("list","Stories and sketches · London · 1921","Monday",titleEm="or Tuesday",note="Eight pieces from the Hogarth Press edition of 1921."),{},pages,look="etching",contact_line="Texts in the public domain"))

# ---------------------------------------------------------------- shared: a museum record becomes a work
def museum_work(lib, base, m, alt=""):
    a=f"{base}/img/{m['file']}"; cm=m.get("cm")
    if cm and ((cm["w"]>cm["h"]) != (m["w"]>m["h"])): cm=None  # a sheet measured the other way round
    tech=m.get("technique") or ""; tech=tech[:1].upper()+tech[1:]
    lib[a]=work(a, m["title"], m["date"], tech, alt or m["title"], place="The Cleveland Museum of Art", line=plain(m.get("wall"))[:1000], edition=m["acc"], made=f"{tech}. {m['credit']}. CC0, clevelandart.org".strip(), cm=cm); return a
def by_acc(M): return {m["acc"].replace(".","-"): m for m in M}
def plain(t): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", (t or "").replace("--", "—"))).strip()

# ---------------------------------------------------------------- Odilon Redon (CC0, Cleveland)
if read("redon"):
    R="/design/samples/redon"; M=by_acc(manifest("redon")); lib={}
    A=lambda acc, alt="": museum_work(lib, R, M[acc], alt)
    flowers=[A("1935-233","A vase of flowers in reds and whites against a warm ground"),A("1958-46","A tall vase of mixed flowers in pastel, blues and oranges"),A("1926-1976","A woman in profile among flowers, in pastel")]
    heads=[A("1988-91","A head in profile with closed eyes, in blue and gold"),A("1926-25","Orpheus's head on a lyre among rocks, in pastel"),A("1927-306","A face with closed eyes, lithograph"),A("1927-344-2","A sad human face on the stem of a marsh flower"),A("1927-299","A pensive figure in graphite"),A("2020-63","A hunched figure in charcoal")]
    noirs=[A("1998-69","Two figures running from an unseen fear, etching"),A("1925-21","Parsifal with a lance, lithograph"),A("1945-389","Brünnhilde in twilight, lithograph"),A("1926-140-6","A woman clothed with the sun, lithograph"),A("1926-140-7","An angel coming out of the temple, lithograph"),A("1966-413-1","A title plate, lithograph")]
    d=lambda acc: plain(M[acc].get("description"))
    pages=[
      story("flowers","Flowers",[piece(flowers[0],full=True),pause(d("1935-233")[:420],"From the museum"),piece(flowers[1],"with-next"),piece(flowers[2])],kicker="1905 – 1916",note="The late still lifes, in oil and in pastel, that brought Redon his success.",arrangement="wall"),
      story("heads","Heads, with",titleEm="closed eyes",pieces=[piece(heads[0],full=True),piece(heads[1],"margin-note",note="Pastel on brown paper, c. 1903 – 10."),pause(d("1926-25")[:420],"From the museum"),piece(heads[2],"with-next"),piece(heads[3]),piece(heads[4],"with-next"),piece(heads[5])],kicker="1868 – 1910",note="Faces that look inward: a motif Redon kept from his first drawings to his last pastels.",arrangement="wall"),
      story("the-noirs","The",titleEm="noirs",pieces=[piece(noirs[0],full=True),pause(d("1998-69")[:420],"From the museum"),piece(noirs[1],"with-next"),piece(noirs[2]),piece(noirs[3],"with-next"),piece(noirs[4]),piece(noirs[5])],kicker="1866 – 1899",note="Twenty years in black: etchings and lithographs made before colour arrived.",arrangement="wall"),
      project("from-black-to-colour","From black",titleEm="to colour",discipline="Lithography, pastel",client="",year="1890 – 1916",summary="Redon worked in charcoal and lithography for two decades, and then, after 1890, almost entirely in pastel and oil. The sequence below sets a lithograph against the pastel that came after it.",process=[noirs[0],heads[2],noirs[3]],outcome=[heads[0],flowers[2],flowers[0]],compare=True,facts=["Charcoal, lithographic crayon, pastel, oil","The noirs: c. 1865 – 1900","The colour work: c. 1890 – 1916"]),
      about([plain(M["1935-233"].get("bio"))[:900].rsplit(".",1)[0]+".","This is a sample site built from works in the Cleveland Museum of Art's open collection, released under CC0. The works are Redon's; the arrangement is the sample's own."]),
      record(["Odilon Redon, 1840 – 1916."],[("Life",[("1840","Born in Bordeaux, 20 April"),("1863","Studies etching with Rodolphe Bresdin"),("1879","Dans le rêve, his first album of lithographs"),("1890","Turns from black to colour: pastel and oil"),("1904","A room of his own at the Salon d'Automne"),("1916","Dies in Paris, 6 July")]),("Collections",[("","The Cleveland Museum of Art"),("","Musée d'Orsay, Paris"),("","The Art Institute of Chicago"),("","The Museum of Modern Art, New York")])]),
      contact(["A sample site. The works are in the Cleveland Museum of Art and are shared by the museum under CC0.","Latent Wall shows them to show what a painter's site can be."]),
    ]
    save("redon", site("salon","Odilon Redon",front("sheet","Paintings, pastels and lithographs · 1866 – 1916","Closed",titleEm="eyes",note="Flowers, heads and the noirs, from the Cleveland Museum of Art's open collection."),lib,pages,look="gesso",contact_line="Works CC0, The Cleveland Museum of Art"))

# ---------------------------------------------------------------- Utagawa Hiroshige (CC0, Cleveland)
if read("hiroshige"):
    H="/design/samples/hiroshige"; M=by_acc(manifest("hiroshige")); lib={}
    A=lambda acc, alt="": museum_work(lib, H, M[acc], alt)
    edo=[A("1921-318","People crossing a bridge under a sudden shower"),A("1985-320","A moonlit promontory seen from a room"),A("1940-986","Fireworks over a bridge at night"),A("1992-73","Boats and an island seen from a bridge"),A("1924-971","A drum bridge in snow"),A("1924-967","Eight views of Kanazawa at night, a triptych"),A("1930-183","The whirlpools of Awa, a triptych")]
    roads=[A("1948-306","Travellers in driving rain"),A("1948-307","A man in wind on a bridge over the Mie river"),A("1985-317","Figures in evening snow at Kambara"),A("1985-323","A night-weeping stone at Sayo no Nakayama"),A("1930-186","A procession at Seki at dawn"),A("1916-939","Yahagi bridge at Okazaki"),A("1940-985","The Tenryu river near Mitsuke"),A("1985-322","Shimosuwa on the Kisokaidō"),A("1942-144","Nagakubo at night"),A("1985-321","Kanō on the Kisokaidō")]
    views=[A("1985-315","Gathering shellfish at low tide"),A("1942-145","Night rain at the Azuma shrine"),A("1940-983","Evening snow at Asuka hill"),A("1985-312","Night rain at Karasaki"),A("1977-174","Gathering shells, a tall pillar print")]
    d=lambda acc: plain(M[acc].get("description"))
    pages=[
      story("one-hundred-views-of-edo","One Hundred Views",titleEm="of Edo",pieces=[piece(edo[0],full=True),pause(d("1921-318")[:400],"From the museum"),piece(edo[1],"with-next"),piece(edo[2]),piece(edo[3],"with-next"),piece(edo[4]),piece(edo[5],full=True),piece(edo[6],full=True)],kicker="1856 – 1858",note="The last great series: the city in rain, snow, fireworks and moonlight.",arrangement="wall"),
      story("the-roads","The",titleEm="roads",pieces=[piece(roads[0],full=True),pause(d("1948-306")[:400],"From the museum"),piece(roads[1],"with-next"),piece(roads[2]),piece(roads[3]),piece(roads[4],"with-next"),piece(roads[5]),piece(roads[6],"with-next"),piece(roads[7]),piece(roads[8],"with-next"),piece(roads[9])],kicker="1833 – 1850",note="Stations of the Tōkaidō and the Kisokaidō: weather, hour and road.",arrangement="wall"),
      story("eight-views","Eight",titleEm="views",pieces=[piece(views[0],full=True),piece(views[1],"with-next"),piece(views[2]),piece(views[3],"margin-note",note="Night rain at Karasaki, from Eight Views of Ōmi, c. 1835."),piece(views[4])],kicker="1830s",note="Night rain, evening snow, low tide: the eight classical views, moved to Japan.",arrangement="wall"),
      about([plain(M["1921-318"].get("bio"))[:900].rsplit(".",1)[0]+".","This is a sample site built from prints in the Cleveland Museum of Art's open collection, released under CC0. The prints are Hiroshige's; the arrangement is the sample's own."]),
      record(["Utagawa Hiroshige, 1797 – 1858."],[("Life",[("1797","Born in Edo, the son of a fire warden"),("1811","Enters the studio of Utagawa Toyohiro"),("1832","Travels the Tōkaidō; the Fifty-three Stations follow"),("1856","Begins One Hundred Famous Views of Edo"),("1858","Dies in Edo, 12 October")]),("Collections",[("","The Cleveland Museum of Art"),("","The Metropolitan Museum of Art, New York"),("","The British Museum, London"),("","Museum of Fine Arts, Boston")])]),
      contact(["A sample site. The prints are in the Cleveland Museum of Art and are shared by the museum under CC0.","Latent Wall shows them to show what a printmaker's site can be."]),
    ]
    save("hiroshige", site("pinboard","Utagawa Hiroshige",front("sheet","Woodblock prints · Edo · 1833 – 1858","Rain, snow",titleEm="and moonlight",note="Twenty-two prints from the Cleveland Museum of Art's open collection."),lib,pages,look="riso",contact_line="Prints CC0, The Cleveland Museum of Art"))

# ---------------------------------------------------------------- Eugène Atget (CC0, Cleveland)
if read("atget"):
    T="/design/samples/atget"; M=by_acc(manifest("atget")); lib={}
    A=lambda acc, alt="": museum_work(lib, T, M[acc], alt)
    streets=[A("1985-115","A narrow Paris street climbing a hill, early morning"),A("1980-35","A quiet street with a cart and shuttered shops"),A("1993-88","The doorway of an old hôtel on the Île Saint-Louis"),A("1985-116","A fountain against a wall at the École Polytechnique"),A("2019-83","An old street in Clamart")]
    parks=[A("1985-113","A statue of Venus among trees at Versailles"),A("1985-114","A fountain with a statue of France triumphant"),A("1985-117","The fountain of Enceladus, half-buried in rock"),A("2002-68","The park at Sceaux at seven in the morning, in April"),A("2019-84","A path through the park at Saint-Cloud")]
    trees=[A("2007-26","A mullein plant in bloom"),A("2002-69","A water lily in a pond"),A("2019-85","The roots of an old tree on a bank")]
    d=lambda acc: plain(M[acc].get("description"))
    pages=[
      story("old-paris","Old",titleEm="Paris",pieces=[piece(streets[0],full=True),pause(d("1985-115")[:420],"From the museum"),piece(streets[1]),piece(streets[2]),piece(streets[3]),piece(streets[4])],kicker="1898 – 1914",note="The streets before the city woke: doorways, carts, fountains, shutters.",arrangement="slides"),
      story("versailles-and-the-parks","Versailles and",titleEm="the parks",pieces=[piece(parks[0],full=True),pause(d("1985-113")[:420],"From the museum"),piece(parks[1]),piece(parks[2]),piece(parks[3],"margin-note",note="April 1925, 7 a.m."),piece(parks[4])],kicker="1904 – 1925",note="Statues and fountains in the royal parks, photographed as if they were people.",arrangement="slides"),
      story("plants","Plants",pieces=[piece(trees[0],full=True),piece(trees[1]),pause(d("2002-69")[:420],"From the museum"),piece(trees[2])],kicker="1897 – 1923",note="Documents for artists: a mullein, a water lily, roots.",arrangement="slides"),
      about([plain(M["1985-115"].get("bio"))[:900].rsplit(".",1)[0]+".","This is a sample site built from photographs in the Cleveland Museum of Art's open collection, released under CC0. The photographs are Atget's; the arrangement is the sample's own."]),
      record(["Eugène Atget, 1857 – 1927."],[("Life",[("1857","Born in Libourne, near Bordeaux, 12 February"),("1879","An actor in provincial touring companies"),("1890","Takes up photography in Paris: documents pour artistes"),("1898","Begins to photograph old Paris, street by street"),("1920","Sells some 2,600 negatives to the French state"),("1927","Dies in Paris, 4 August")]),("Collections",[("","The Cleveland Museum of Art"),("","The Museum of Modern Art, New York"),("","Bibliothèque nationale de France, Paris"),("","Musée Carnavalet, Paris")])]),
      contact(["A sample site. The photographs are in the Cleveland Museum of Art and are shared by the museum under CC0.","Latent Wall shows them to show what a photographer's site can be."]),
    ]
    save("atget", site("lantern","Eugène Atget",front("covers","Photographs · Paris · 1897 – 1925","Documents",titleEm="for artists",note="Thirteen albumen prints from the Cleveland Museum of Art's open collection."),lib,pages,look="albumen",contact_line="Photographs CC0, The Cleveland Museum of Art"))

# ---------------------------------------------------------------- Samuel Palmer (CC0, Cleveland): the drawing and the plate
if read("palmer"):
    P="/design/samples/palmer"; M=by_acc(manifest("palmer")); lib={}
    A=lambda acc, alt="": museum_work(lib, P, M[acc], alt)
    golden=A("2009-3","A golden sunset over a valley with sheep and a shepherd, in watercolour"); skylark_d=A("1945-330","A skylark rising over a cottage at dawn, pen and ink"); skylark=A("1966-181","A skylark rising over a cottage at dawn, etching")
    plates=[A("1966-185","Figures at a vine in moonlight, etching"),A("1966-191","A ploughman at dawn with a church beyond, etching"),A("1966-188","A rising moon over a valley, etching"),A("1966-194","Children at play in a wooded morning, etching"),A("1966-197","A bellman walking a village street at night, etching"),A("1966-199","A lone tower on a hill under stars, etching"),A("1966-204","A cypress grove by moonlight, etching")]
    states=[A("1966-198","The Bellman, another state of the plate"),A("1921-966","The Lonely Tower, another state of the plate")]
    d=lambda acc: plain(M[acc].get("description"))
    pages=[
      story("the-etchings","The",titleEm="etchings",pieces=[piece(plates[0],full=True),pause(d("1966-185")[:420],"From the museum"),piece(plates[1],"with-next"),piece(plates[2]),piece(plates[3]),piece(plates[4],"with-next"),piece(plates[5]),piece(plates[6])],kicker="1850 – 1883",note="Thirteen plates in thirty years: moonlight, dawn, and the valley of vision.",arrangement="wall"),
      story("the-golden-hour","The golden",titleEm="hour",pieces=[piece(golden,full=True),pause(d("2009-3")[:420],"From the museum")],kicker="1865",note="A late watercolour, worked up over years.",arrangement="wall"),
      project("the-skylark","The",titleEm="skylark",discipline="Pen and ink, then etching",client="",year="1850",summary="The drawing came first: pen and ink over graphite, heightened with white. The plate followed the same year, and Palmer went on reworking it in state after state. Here the drawing is set against the print.",process=[skylark_d],outcome=[skylark],compare=True,facts=["Drawing: pen and ink over graphite, c. 1850","Plate: etching, 1850","The Cleveland Museum of Art, 1945.330 and 1966.181"]),
      project("states-of-a-plate","States of",titleEm="a plate",discipline="Etching",client="",year="1879",summary="An etching is finished more than once. The Bellman and The Lonely Tower, both of 1879, exist in several states, and the museum keeps two of each: one is set against the other.",process=states,outcome=[plates[4],plates[5]],compare=True,facts=["The Bellman, 1879: two states","The Lonely Tower, 1879: two states"]),
      about([plain(M["2009-3"].get("bio"))[:900].rsplit(".",1)[0]+".","This is a sample site built from works in the Cleveland Museum of Art's open collection, released under CC0. The works are Palmer's; the arrangement is the sample's own."]),
      record(["Samuel Palmer, 1805 – 1881."],[("Life",[("1805","Born in Newington, London, 27 January"),("1824","Meets William Blake"),("1826","Moves to Shoreham, Kent: the valley of vision"),("1837","Marries Hannah Linnell; two years in Italy"),("1850","Takes up etching; The Skylark"),("1881","Dies at Redhill, Surrey, 24 May")]),("Collections",[("","The Cleveland Museum of Art"),("","The British Museum, London"),("","Yale Center for British Art, New Haven"),("","Ashmolean Museum, Oxford")])]),
      contact(["A sample site. The works are in the Cleveland Museum of Art and are shared by the museum under CC0.","Latent Wall shows them to show what a printmaker's studio site can be."]),
    ]
    save("palmer", site("studio","Samuel Palmer",front("sheet","Etchings and drawings · Shoreham, Redhill · 1850 – 1883","The valley",titleEm="of vision",note="Plates, their states and the drawings before them, from the Cleveland Museum of Art's open collection."),lib,pages,look="etching",contact_line="Works CC0, The Cleveland Museum of Art"))

# ---------------------------------------------------------------- Dorothea Lange (public domain, Library of Congress via Commons): a journal
MONTHS=["","January","February","March","April","May","June","July","August","September","October","November","December"]
BOILER=re.compile(r"Library of Congress|Scope and content|Full caption|Public Domain|pingnews|This image|digital ID|Suggested credit|Call number|TMS |Universal Unique|Title and date|Additional information|^Content:|^Photo(graph)? by|By Dorothea|Dorothea Lange|Farm Securit(y|ies) Administration|copyright tag|Commons:|CREATED/PUBLISHED|^TITLE:|^NOTES:|^SUBJECTS:|^MEDIUM:|^REPOSITORY:", re.I)
def sentences(desc): return [x.strip() for x in re.split(r"(?<![A-Z]\.)(?<=[.?!])\s+(?=[A-Z\"'])", desc.strip()) if x.strip()]
def lange_caption(desc):
    desc=re.split(r"\s*\b[A-Z]{3,}(?:/[A-Z]+)?:|\s*\(LOC description\)|\s*N\.B\.;|\s*LOT \d", desc)[0]
    keep=[x for x in sentences(desc) if not BOILER.search(x)]
    out=" ".join(keep).strip(); out=re.sub(r"\s+-\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}.*$","",out)
    out=re.sub(r",?\s*\b8b\d{4,}\w*","",out).strip()
    if "Migrant Mother" in out or "Florence Thompson" in out: out="Migrant Mother, Nipomo, California. Florence Owens Thompson, thirty-two, with three of her children, in a pea pickers' camp."
    return out
def lange_title(desc):
    c=lange_caption(desc); first=sentences(c)[0] if c else ""
    return first.strip().rstrip(".").strip('"')[:120]
if read("lange"):
    L="/design/samples/lange"; M=manifest("lange"); lib={}; entries={}
    for m in M:
        a=f"{L}/img/{m['file']}"; desc=lange_caption(m["desc"]) or re.sub(r",?\s*\b8b\d{4,}\w*","",re.sub(r"\.(jpg|tif)$","",m["title"][5:]))
        ym=re.match(r"(\d{4})-(\d{2})", m["date"]); y=ym.group(1) if ym else (re.search(r"\d{4}", m["date"]) or re.search(r"\d{4}", m["desc"]) or ["1936"])[0]
        mo=int(ym.group(2)) if ym else 0; date=(MONTHS[mo]+" "+y) if mo else y
        t=lange_title(desc) or m["title"][5:]
        lib[a]=work(a, t, date, "Farm Security Administration", t, place="Library of Congress, Prints and Photographs Division", line=desc[:1000], edition=re.sub(r"\.(jpg|tif)$","",m["title"][5:])[:200], made="Public domain: a work of the United States government. Library of Congress via Wikimedia Commons.")
        entries.setdefault((y,mo),[]).append((a,desc))
    pages=[]
    for (y,mo),items in sorted(entries.items()):
        k=f"{y}-{mo:02d}"; title=(MONTHS[mo] if mo else "In")+" "+y
        places=[re.search(r"([A-Z][A-Za-z' ]+ County, [A-Z][a-z]+|[A-Z][a-z]+(?: [A-Z][a-z]+)?, (?:California|Oklahoma|Arizona|Texas|Utah|Alabama|New Mexico|Mississippi|Georgia|Louisiana|Arkansas))", d) for a,d in items]
        places=[p.group(1) for p in places if p]; place=max(set(places), key=places.count) if places else ""
        pieces=[piece(items[0][0],full=True)]+[piece(a,"alone",note="") for a,d in items[1:]]
        note=""
        for x in sentences(items[0][1]):
            if len(note)+len(x)>300: break
            note=(note+" "+x).strip()
        pages.append(story(k, title, pieces, kicker=place or ("On the road" if mo else y), note=note or items[0][1][:300], arrangement="held"))
    pages+= [about(["Dorothea Lange photographed for the Resettlement Administration and then the Farm Security Administration from 1935 to 1939, driving the roads of California and the South and writing down, beside each negative, what the people in it had told her. The captions here are hers, as the Library of Congress keeps them.","This is a sample site: the photographs are works of the United States government and in the public domain, from the Library of Congress by way of Wikimedia Commons. The entries follow her dates; the words about them are the sample's own."]),
             record(["Dorothea Lange, 1895 – 1965."],[("Life",[("1895","Born in Hoboken, New Jersey, 26 May"),("1918","Opens a portrait studio in San Francisco"),("1935","Begins photographing for the Resettlement Administration"),("1936","Migrant Mother, Nipomo, California, in March"),("1939","An American Exodus, with Paul Taylor"),("1942","Photographs the internment of Japanese Americans"),("1965","Dies in San Francisco, 11 October")]),("Collections",[("","Library of Congress, Washington"),("","Oakland Museum of California"),("","The Museum of Modern Art, New York")])]),
             contact(["A sample site. The photographs are in the public domain, from the Library of Congress.","Latent Wall shows them to show what a documentary photographer's site can be."])]
    save("lange", site("journal","Dorothea Lange",front("journal","Photographs for the Farm Security Administration · 1936 – 1939","The road",titleEm="and the people on it",note="Entries from four years on the road, in her own captions."),lib,pages,look="toned",contact_line="Photographs in the public domain, Library of Congress"))

# ---------------------------------------------------------------- Historic American Buildings Survey (public domain): four houses, drawings beside photographs
if read("habs"):
    Hb="/design/samples/habs"; M=manifest("habs"); lib={}
    houses={"farnsworth":("Farnsworth",titleEm:="House","Edith Farnsworth House, Plano, Illinois","Ludwig Mies van der Rohe","1951","HABS ILL,47-PLANO.V,1-","A weekend house of steel and glass on the bank of the Fox River, raised above the flood. The survey photographed it and measured it; the sheets are set against the photographs."),
            "robie":("Robie","House","Frederick C. Robie House, Chicago, Illinois","Frank Lloyd Wright","1910","HABS ILL,16-CHIG,33-","Long brick planes and cantilevered roofs on a corner lot in Hyde Park: the fullest of the Prairie houses. The survey's drawings record it floor by floor."),
            "gamble":("Gamble","House","Gamble House, Pasadena, California","Greene & Greene","1908","HABS CAL,19-PASA,5-","A house of timber, joinery and shadow, built for the Gamble family of Cincinnati. The survey drew its plans and elevations sheet by sheet."),
            "lovell-beach":("Lovell","Beach House","Lovell Beach House, Newport Beach, California","Rudolph Schindler","1926","HABS CAL,30-NEWBE,1-","Five concrete frames lift the house above the sand; the living room hangs between them. Photographed and drawn by the survey.")}
    byhouse={}
    for m in M:
        key=m["house"]
        name=re.sub(r"\.(tif|tiff|png|jpg)$","",m["title"][5:],flags=re.I); sheet=m["kind"]=="sheet"
        cap=name.split(" - ")[0].strip().capitalize() if " - " in name and not sheet else name
        if sheet:
            sm=re.search(r"sheet (\d+) of (\d+)", name+m["desc"], re.I); cap=f"Sheet {sm.group(1)} of {sm.group(2)}" if sm else "Measured drawing"
        if re.match(r"Mies van der Rohe photo", name): cap="View of the house"
        if "Highsmith" in (m.get("artist","")+m.get("desc","")): cap="Photograph by Carol M. Highsmith"
        if not sheet and " - " in name: cap=name.split(" - ")[0].strip().capitalize()
        if not sheet and len(cap)>40 and "," in cap: cap=cap.split(",")[0].strip()
        if sheet and not re.match(r"Sheet \d", cap):
            sm=re.search(r"^(.*?) - ", name); cap=(sm.group(1).strip() if sm and len(sm.group(1))<60 else "Measured drawing")
        h=houses[key]; a=f"{Hb}/img/{m['file']}"
        lib[a]=work(a, f"{h[2].split(',')[0]}: {cap}", "", "Measured drawing" if sheet else "Photograph", f"{'Measured drawing' if sheet else 'Photograph'} of the {h[2].split(',')[0]}: {cap.lower()}", place="Library of Congress, Prints and Photographs Division", line=(m["desc"] or name)[:1000], edition=h[5], made="Public domain: a work of the United States government. Historic American Buildings Survey, Library of Congress, via Wikimedia Commons.")
        byhouse.setdefault(key,{"photos":[],"sheets":[]})["sheets" if sheet else "photos"].append(a)
    pages=[]
    for key,(t,te,full,arch,year,no,summary) in houses.items():
        b=byhouse.get(key,{"photos":[],"sheets":[]})
        if not b["photos"] and not b["sheets"]: continue
        pages.append(project(key, t, titleEm=te, discipline="Measured drawings and photographs", client="National Park Service", year=year, summary=summary, outcome=b["photos"], process=b["sheets"], compare=bool(b["photos"] and b["sheets"]), facts=[f"Architect: {arch}", f"Built: {year}", f"Survey: {no}"]))
    pages+= [about(["The Historic American Buildings Survey has recorded buildings across the United States since 1933: measured drawings, large-format photographs and written histories, made to a standard and given to the Library of Congress. It is the oldest federal preservation programme in the country, and a studio of record in all but name.","This is a sample site built from four of its records. The drawings and photographs are works of the United States government and in the public domain, from the Library of Congress by way of Wikimedia Commons; the words here are the sample's own."]),
             record(["The survey, in dates."],[("Programme",[("1933","Founded under the Civil Works Administration"),("1934","A tripartite agreement with the Library of Congress and the American Institute of Architects"),("1969","The Historic American Engineering Record is added"),("2000","The Historic American Landscapes Survey is added")]),("Collection",[("","Library of Congress, Prints and Photographs Division"),("","More than 45,000 buildings and sites recorded")])]),
             contact(["A sample site. The drawings and photographs are in the public domain, from the Library of Congress.","Latent Wall shows them to show what an architecture studio's site can be."])]
    save("habs", site("atelier","Historic American Buildings Survey",front("list","Measured drawings and photographs · four houses · 1908 – 1951","Drawn and",titleEm="photographed",note="Four houses from the survey's record, each measured and photographed."),lib,pages,look="blueprint",contact_line="Records in the public domain, Library of Congress"))
