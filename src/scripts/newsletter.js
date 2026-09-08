// Newsletter / waitlist subscribe — progressive enhancement.
//
// Posts to our own same-origin /api/subscribe (a Cloudflare Pages Function) which
// relays to Buttondown's authenticated API. Because it's same-origin we can READ
// the real result and show an honest success/error — unlike the old cross-origin
// `mode:'no-cors'` POST, whose response was unreadable, so a rejected signup still
// resolved and showed a false "It's on its way". Supports multiple independent
// forms, each wrapped in its own [data-newsletter].

(() => {
  const roots = document.querySelectorAll('[data-newsletter]');
  if (!roots.length) return;

  roots.forEach((root) => {
    const form = root.querySelector('[data-newsletter-form]');
    if (!form) return;
    const input = form.querySelector('input[type="email"]');
    if (!input) return;
    const errorEl = root.querySelector('[data-newsletter-error]');
    const doneEl = root.querySelector('[data-newsletter-done]');
    const submitBtn = form.querySelector('[type="submit"]');

    const showError = (msg) => {
      if (errorEl) {
        if (msg) errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      if (submitBtn) submitBtn.disabled = false;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!input.checkValidity()) {
        showError("That email doesn't look right.");
        input.focus();
        return;
      }
      if (errorEl) errorEl.hidden = true;
      if (submitBtn) submitBtn.disabled = true;

      const action = form.getAttribute('action') || '/api/subscribe';
      const tagField = form.querySelector('input[name="tag"]');
      const listField = form.querySelector('input[name="list"]');
      const hpField = form.querySelector('input[name="website"]');

      try {
        const res = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: input.value.trim(),
            tag: tagField ? tagField.value : '',
            list: listField ? listField.value : '',
            website: hpField ? hpField.value : '',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          if (doneEl) doneEl.hidden = false;
          root.classList.add('is-done');
        } else {
          showError('Something went wrong — please try again in a moment.');
        }
      } catch {
        showError("Couldn't reach us — check your connection and try again.");
      }
    });
  });
})();
