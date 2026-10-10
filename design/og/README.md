# The link preview card

`public/og.png` (1200 × 630) is rendered from `card.html`: the Safelight L. on its own dark ground, the wordmark in Cormorant Garamond, the line "Born before the act" in Instrument Sans. To re-render after a change:

```
node design/og/render.mjs "$PWD/design/og/card.html" public/og.png
```

then bump `?v=N` on `ogImage` in `src/layouts/Base.astro` so link previews refetch.
