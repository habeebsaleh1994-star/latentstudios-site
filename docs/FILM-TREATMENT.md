# Latent, the film

Second treatment, 4 September 2026. Replaces the first entirely.
Source: the founder interview (docs/INTERVIEW.md), the inspiration
folder, and sixteen test stills (design/stills).

## What it is

An abstract animation, about a minute long, about what exists before it
can be seen. Not a film about photography or about products. A film
about latency: the image born before the act, texture and colour coming
back into the world. Something from this world and out of it. Latent,
until it has full presence, like a burst.

## The one rule

Show what film and paint are made of, never what they make. Dye in
gelatin, silver in grain, pigment in paper fibre, light bleeding at an
edge, a wash soaking in, a line arriving. The moment a frame becomes a
recognisable painting, or a photograph of a place, it has crossed the
line. Stills 12, 4 and 13 are on the right side. 14 and 15 are not.

## The shape

Development itself: nothing, nothing, nothing, then everything at once.

1. **Slow** (0:00 to 0:15). Almost nothing. The surface of a screen, cool
   grey, perfectly smooth. Then the first thing to exist: a fibre. Then
   a grain. Then a breath of warmth. Held so long it is uncomfortable.
2. **Faster** (0:15 to 0:35). Cut on cut, each shorter than the last.
   Materials arriving: silver crystallising, dye soaking into paper, a
   red-chalk line drawing itself, halation blooming around a point of
   light, a wash of rose, a wash of ochre, indigo spreading. Glimpses of
   the room and the road pass inside the cuts, a second each: a candle,
   a window, a tree in white, a hand turning a leaf. Never long enough
   to become a place.
3. **Climax** (0:35 to 0:42). The cuts become a pulse. Every material at
   once, overlapping, building. Texture everywhere. Then a hard hold on
   black, or on the grey screen we began with, for one breath.
4. **The birth** (0:42 to 0:52). One shot, slow again. Colour and texture
   arrive with full presence: not a paint splat, a bloom of dye and
   light and grain filling the frame from one point outward, warm, the
   palette of still 12. The tree from still 1 is faintly inside it, or
   is not; either way, an image is now there that was not.
5. **Still** (0:52 to 1:00). Paper. The frame draws itself, open at one
   corner. The name. Then the line, small: "The photograph is already
   there." Cut to paper.

## Words

Three at most, and none until the end. The birth needs no caption.

## Sound

Room tone, the paper, water. The acceleration is heard before it is
seen: a low pulse that quickens with the cuts and stops dead at the
hold. The birth is silent, then one held note. The frame draws in
silence.

## Palette

From still 12 and the inspiration folder: cream, rose, ochre, sage, pale
indigo, warm silver. The screen grey only at the start, and once more at
the hold before the birth. No black except the very first frame.

## How it is made

Two layers, both in code, no live footage:

- **The materials** are generated as short clips from the stills that
  passed (12, 4, 13, 2's silver, 1's tree arriving) through Runway's video
  models, image to video, so that each frame we approved becomes four to
  eight seconds of that material moving: dye spreading, silver growing,
  a line drawing itself. This needs the paid plan; the stills say it is
  worth it now.
- **The structure** is code: the timeline, the acceleration, the cuts,
  the pulse, the birth's timing, the frame drawing itself, the words,
  the export. The scaffold already exists (design/film/build.mjs).

Nothing in the film is a photograph of a place or a painting of a
thing. It is the stuff they are made of, coming alive.
