// The site-wide announcement bar (2026-10-16): one line at the top of every page. `on: false` takes it down; a new
// `id` shows it again to visitors who closed an earlier one (the close is remembered per id, in this browser only).
// First use: the Canon firmware, because visitors took The Ritual for Mac (paid, needs a Mac) for the 5D firmware.
// No "free" (owner, 2026-10-16): it ships as pay what you want, so nothing promises a price before release.
export const announce = Object.freeze({
  on: true,
  id: 'firmware-2026-10',
  href: '/firmware',
  lead: 'The Ritual for Canon 5D and 5D Mark II: firmware, coming soon.',
  short: 'The Ritual for Canon 5D: firmware, coming soon.',
  tail: 'It runs in the camera. The Ritual for Mac, the whole darkroom, is available now.',
  door: 'Get notified',
});
