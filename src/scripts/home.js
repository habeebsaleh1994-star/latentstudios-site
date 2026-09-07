// Latent Studios homepage — the peony opens as the page is read, words develop in as they arrive.
//
// 1. Reveal: [data-reveal] gets .is-in when it enters the viewport. Anything the reader has
//    already scrolled past is revealed explicitly (a jump from below to above the viewport never
//    changes intersection state), so nothing is ever left hidden.
// 2. Peony: 96 frames scrubbed by scroll progress 0→1 across the whole document, drawn to a
//    canvas at ≤2× DPR. The stage also drifts up 4% and scales 1.08→1.00 over the same travel, so
//    no pixel of scroll is still. Reduced motion: final frame, no drift.

(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── reveal ──
  const els = document.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
  } else {
    const pending = new Set(els);
    const reveal = (el) => { el.classList.add('is-in'); pending.delete(el); io.unobserve(el); };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting || e.boundingClientRect.bottom < 0) reveal(e.target);
    }, { rootMargin: '0px 0px 180px 0px', threshold: 0 });
    els.forEach((el) => io.observe(el));
    window.addEventListener('scroll', () => {
      for (const el of pending) if (el.getBoundingClientRect().bottom < 0) reveal(el);
    }, { passive: true });
  }

  // ── peony ──
  const c = document.querySelector('[data-frames]');
  if (!c) return;
  const base = c.dataset.frames;
  const N = parseInt(c.dataset.frameCount, 10);
  const narrow = window.matchMedia('(max-width: 720px)').matches;
  // Scroll travel is measured once per layout, not per scroll: on a phone the
  // address bar collapsing changes innerHeight mid-scroll, and re-measuring
  // there makes the plant jump. A width change (rotation) re-measures.
  let travel = 1, measuredAt = 0;
  const measure = () => { measuredAt = window.innerWidth; travel = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
  const stage = c.parentElement;
  const g = c.getContext('2d');
  let want = 0, shown = -1, raf = 0;

  const draw = (i) => {
    const im = frames[i];
    if (!im.complete || !im.naturalWidth) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.drawImage(im, 0, 0, w, h);
    shown = i;
  };

  const frames = Array.from({ length: N }, (_, i) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { if (i === want && i !== shown) draw(i); };
    im.src = `${base}${String(i).padStart(3, '0')}.webp`;
    return im;
  });

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (measuredAt !== window.innerWidth) measure();
      const p = reduce ? 1 : Math.min(1, Math.max(0, (window.scrollY || 0) / travel));
      want = Math.round(p * (N - 1));
      if (want !== shown) draw(want);
      if (stage && !reduce) {
        // On a phone the plant is centred and only breathes; on the desktop it drifts up and settles.
        stage.style.transform = narrow
          ? `translate(-50%, -50%) scale(${(1.04 - p * 0.04).toFixed(4)})`
          : `translate(-50%, ${(-44 - p * 4).toFixed(2)}%) scale(${(1.08 - p * 0.08).toFixed(4)})`;
      }
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { shown = -1; if (measuredAt !== window.innerWidth) measure(); onScroll(); });
  window.addEventListener('load', () => { measure(); onScroll(); });
})();
