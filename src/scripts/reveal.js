// Reveal only — the homepage's [data-reveal] behaviour, extracted so pages without a
// peony (the Moment, later the Ritual and the Lab) can share it. home.js keeps its own copy.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = document.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const pending = new Set(els);
  const reveal = (el) => { el.classList.add('is-in'); pending.delete(el); io.unobserve(el); };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting || e.boundingClientRect.bottom < 0) reveal(e.target);
  }, { rootMargin: '0px 0px 180px 0px', threshold: 0 });
  els.forEach((el) => io.observe(el));
  window.addEventListener('scroll', () => {
    for (const el of pending) if (el.getBoundingClientRect().bottom < 0) reveal(el);
  }, { passive: true });
})();
