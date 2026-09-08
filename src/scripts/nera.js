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
  let shown = -1, shownFull = false, want = 26;

  // Two tiers of the same frames: a small set (540×960) that arrives in a moment, so she is
  // on the silk with the page, and the full set (1620×2880, near-lossless) that replaces
  // each frame as it lands. Fetched a few at a time, from the bud's first loosening outward,
  // so what she is about to show is always what arrives next.
  const pad = (i) => String(i).padStart(3, '0');
  const small = Array.from({ length: N }, () => new Image());
  const full = Array.from({ length: N }, () => new Image());
  const ready = (im) => im.complete && im.naturalWidth > 0;
  const best = (i) => (ready(full[i]) ? full[i] : ready(small[i]) ? small[i] : null);

  const draw = (i) => {
    const im = best(i);
    if (!im) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.clearRect(0, 0, w, h);
    g.drawImage(im, 0, 0, w, h);
    shown = i; shownFull = im === full[i];
  };

  const order = [26];
  for (let d = 1; d < N; d++) { if (26 + d < N) order.push(26 + d); if (26 - d >= 0) order.push(26 - d); }
  const queue = [...order.map((i) => [small, i]), ...order.map((i) => [full, i])];
  let inflight = 0;
  const pump = () => {
    while (inflight < 4 && queue.length) {
      const [tier, i] = queue.shift();
      const im = tier[i];
      inflight++;
      im.decoding = 'async';
      im.onload = im.onerror = () => {
        inflight--;
        if (i === want && (i !== shown || (tier === full && !shownFull))) draw(i);
        pump();
      };
      im.src = `${base}${tier === small ? 'small/' : ''}${pad(i)}.webp`;
    }
  };
  pump();

  if (reduce) { want = 50; draw(50); return; }

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
      want = i;
      if (i !== shown || (!shownFull && ready(full[i]))) draw(i);
    } else {
      last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
  window.addEventListener('resize', () => { shown = -1; });
})();
