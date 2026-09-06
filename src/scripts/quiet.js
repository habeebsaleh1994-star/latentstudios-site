// Quiet motion for Latent the Ritual.
// One observer reveals sections on scroll; one handler tints
// the Materials heading toward the hovered film stock.

(() => {
  // A page that carries its own motion (the homepage) sets data-no-quiet on
  // <body> through Base.astro's `quiet={false}` and gets none of this.
  if (document.body.hasAttribute('data-no-quiet')) return;

  // Respect prefers-reduced-motion. The CSS already shows the static
  // final state under that media query, so we just bail (after wiring the
  // lamplight, which is a tone shift, not motion).
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- The lamplit evening -------------------------------------------
  // Base.astro sets html.is-evening before first paint (after local sunset,
  // or per the visitor's stored choice). Here we only wire the footer lamp:
  // one press warms the room, another puts the lamp out, and the choice is
  // kept for next time.
  const LAMP_KEY = 'latent-lamp';
  const lamp = document.querySelector('[data-lamp]');
  if (lamp instanceof HTMLElement) {
    const sync = () => {
      lamp.setAttribute(
        'aria-pressed',
        String(document.documentElement.classList.contains('is-evening'))
      );
    };
    sync();
    lamp.addEventListener('click', () => {
      const on = document.documentElement.classList.toggle('is-evening');
      try { localStorage.setItem(LAMP_KEY, on ? 'on' : 'off'); } catch {}
      sync();
    });
  }

  if (reduce.matches) {
    // Reduced motion: ambient loops don't run themselves. Posters stand,
    // and the native controls become the visitor's opt-in to watch.
    for (const video of document.querySelectorAll('video[autoplay], video[data-autoplay]')) {
      video.removeAttribute('autoplay');
      video.pause();
      video.controls = true;
    }
    return;
  }

  // ---------- Safelight ------------------------------------------------------
  // A faint amber pool that trails the pointer, the one light a darkroom
  // allows. Fine pointers only (it's meaningless under a thumb), and it
  // sits below this file's reduce guard so reduced-motion visitors never
  // get a moving light. The lerp keeps it drifting a beat behind the
  // hand — a lamp you carry, not a cursor skin.
  if (window.matchMedia('(pointer: fine)').matches) {
    const safelight = document.createElement('div');
    safelight.className = 'safelight';
    safelight.setAttribute('aria-hidden', 'true');
    document.body.appendChild(safelight);

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let x = tx;
    let y = ty;

    // Over a photograph the lamp comes in closer: tighter, a touch
    // warmer. Over text it stays back.
    let targetScale = 1;
    let scale = 1;

    window.addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      const overPrint = e.target instanceof Element && e.target.closest('img, video, picture');
      targetScale = overPrint ? 0.72 : 1;
      safelight.classList.toggle('is-close', !!overPrint);
    }, { passive: true });

    const drift = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      scale += (targetScale - scale) * 0.08;
      safelight.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      requestAnimationFrame(drift);
    };
    requestAnimationFrame(drift);
  }

  // ---------- Section reveals ----------------------------------------------
  const revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      {
        // Trigger 200px BEFORE the element reaches the viewport bottom.
        // By the time the scroll brings the element into actual view,
        // it's already most of the way through its fade-up — feels like
        // things "are" rather than "happen".
        rootMargin: '0px 0px 200px 0px',
        threshold: 0,
      }
    );

    for (const el of revealEls) io.observe(el);
  } else {
    // No IntersectionObserver support: reveal everything immediately.
    for (const el of revealEls) el.classList.add('is-visible');
  }

  // ---------- Materials hover tint -----------------------------------------
  const materials = document.querySelector('.materials');
  if (materials) {
    materials.addEventListener('mouseover', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const stock = target.closest('.stock');
      if (stock && stock instanceof HTMLElement && stock.dataset.swatch) {
        materials.style.setProperty('--hover-tint', stock.dataset.swatch);
      }
    });
    materials.addEventListener('mouseleave', () => {
      materials.style.removeProperty('--hover-tint');
    });
  }

  // ---------- Autoplay loop discipline --------------------------------------
  // Several autoplay-muted videos on one page can collide with browser
  // autoplay heuristics; anything below the fold at page load is often
  // silently skipped. Calling .play() explicitly when a loop enters the
  // viewport gets around that, and pausing when it leaves saves CPU and
  // battery on phones. Applies to every declared autoplay loop on the page
  // (the Lab hero reel, the Ritual Story reader, and whatever follows).
  //
  // `data-autoplay` is the deferred variant: Chrome fetches a video whose
  // markup carries the real `autoplay` attribute even with preload="none",
  // so a below-the-fold loop declares itself here instead and stays entirely
  // unfetched until it is scrolled to. No JS: the poster simply stands.
  const loopVideos = document.querySelectorAll('video[autoplay], video[data-autoplay]');
  if ('IntersectionObserver' in window && loopVideos.length) {
    const videoIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = /** @type {HTMLVideoElement} */ (entry.target);
          if (entry.isIntersecting) {
            const p = video.play();
            if (p !== undefined) p.catch(() => {/* autoplay blocked, leave poster */});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.25 }
    );

    for (const video of loopVideos) videoIO.observe(video);
  }
})();
