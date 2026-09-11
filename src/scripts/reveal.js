// Reveal + in-view video, shared by the pages that have no peony (the Moment, the Ritual,
// later the Lab). home.js keeps its own copy of the reveal half.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // Videos stay unloaded until they are near the viewport, then play; they pause when out.
  const vids = document.querySelectorAll('video[data-autoplay]');
  if (!vids.length) return;
  if (reduce || !('IntersectionObserver' in window)) { vids.forEach((v) => v.removeAttribute('loop')); return; }
  const vio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      // play() starts the fetch itself once preload is lifted; a load() here would abort it.
      if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); }
      else v.pause();
    }
  }, { rootMargin: '200px 0px', threshold: 0 });
  vids.forEach((v) => vio.observe(v));
})();
