# Key the painted peony off its paper.
# The paper is not one colour: it carries a soft vignette. So each frame's paper is
# modelled as a smooth field (normalised blur of the pixels that are surely paper),
# the flower is what departs from that field, the silhouette is closed and hole-filled
# so pale petals stay whole, specks are dropped, and the boundary is feathered 1px.
import sys, os, glob, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
PAPER=np.array([221,203,187],dtype=np.float32)
def key(path):
    im=np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    d0=np.abs(im-PAPER).max(axis=2)
    surely_paper=ndi.binary_erosion(d0<14, iterations=12)          # well away from anything flower
    w=surely_paper.astype(np.float32)
    num=np.dstack([ndi.gaussian_filter(im[...,c]*w, 40) for c in range(3)]); den=ndi.gaussian_filter(w,40)[...,None]
    field=np.where(den>1e-3, num/np.maximum(den,1e-3), PAPER)      # the paper as a smooth field
    d=np.abs(im-field).max(axis=2)
    sil=d>6
    sil=ndi.binary_closing(sil, structure=np.ones((3,3)), iterations=6, border_value=0)
    sil=ndi.binary_fill_holes(sil)
    lab,n=ndi.label(sil)
    if n>1:
        sizes=ndi.sum(sil,lab,range(1,n+1)); sil=np.isin(lab,[i+1 for i,s in enumerate(sizes) if s>=1500])
    sil=ndi.binary_opening(sil, structure=np.ones((3,3)), iterations=1)
    a=np.asarray(Image.fromarray((sil*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)/255
    return Image.fromarray(np.dstack([im, a*255]).astype(np.uint8),'RGBA'), a
if __name__=='__main__':
    src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
    frames = sys.argv[3:] or sorted(os.path.basename(f) for f in glob.glob(src+'/*.webp'))
    tot=0
    for n in frames:
        k,_=key(f'{src}/{n}'); k.save(f'{dst}/{n}','WEBP',quality=82,method=4); tot+=os.path.getsize(f'{dst}/{n}')
    print(len(frames),'frames, MB %.1f'%(tot/1e6))
