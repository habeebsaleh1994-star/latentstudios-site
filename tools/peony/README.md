# Keying the peony off its paper

The homepage frames in `public/peony/` are the painted peony with the paper
removed, so the flower sits on the page's own silk and weave and needs no
feather around it. `key.py` does the removal, the same idea used for Nera's
frames in the NearMic app: the paper is modelled per frame as a smooth colour
field, the flower is whatever departs from it, the silhouette is closed and
hole-filled so pale petals stay whole, and the boundary is feathered by a pixel.

    python3 tools/peony/key.py <folder of opaque frames> public/peony

Needs Pillow, NumPy and SciPy. Re-run it whenever the frames are regenerated;
if the painting's paper changes colour, update `PAPER` at the top.
