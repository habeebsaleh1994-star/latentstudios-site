// Nera's page — the flower is her, so it behaves as it does in the app (NeraPeony.swift),
// not as on the homepage: it is not scrubbed by scroll. It breathes: a slow inhale with a
// lighter voice riding on it, easing toward its target with a fast attack and slow release.
// Drawing is home.js's: decoded Images to a canvas, an unloaded frame never painted.
// Reveal is identical to home.js.

(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── reveal (as home.js) ──
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

  // ── peony, breathing ──
  const c = document.querySelector('[data-frames][data-breathes]');
  if (!c) return;
  const base = c.dataset.frames;
  const N = parseInt(c.dataset.frameCount, 10);
  const g = c.getContext('2d');
  let shown = -1;

  const draw = (i) => {
    const im = frames[i];
    if (!im.complete || !im.naturalWidth) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.clearRect(0, 0, w, h);
    g.drawImage(im, 0, 0, w, h);
    shown = i;
  };

  const frames = Array.from({ length: N }, (_, i) => {
    const im = new Image();
    im.decoding = 'async';
    im.src = `${base}${String(i).padStart(3, '0')}.webp`;
    return im;
  });

  // She appears at the bud's first loosening, whichever frame decodes first.
  frames[26].onload = () => { if (shown < 0) draw(26); };
  if (reduce) { frames[50].onload = () => draw(50); return; }

  // The breath. Frame is a continuous value 0…95; target moves with a 4.6 s inhale and a
  // "voice" that comes and goes. Attack 6/s, release 2.2/s — she leans in and lets go slowly.
  let frame = 26, last = performance.now(), t = 0, paused = false;
  const tick = (now) => {
    if (!paused) {
      const dt = Math.min(0.2, (now - last) / 1000); last = now; t += dt;
      const breath = Math.sin(t * 1.37) * 0.5 + 0.5;
      const voice = Math.max(0, Math.sin(t * 3.1) * Math.sin(t * 1.9)) * 0.9;
      const target = 24 + breath * 22 + voice * 18;
      const k = 1 - Math.exp(-(target > frame ? 6 : 2.2) * dt);
      frame = Math.max(0, Math.min(N - 1, frame + (target - frame) * k));
      const i = Math.round(frame);
      if (i !== shown) draw(i);
    } else {
      last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
  window.addEventListener('resize', () => { shown = -1; });
})();
