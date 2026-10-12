// The one publication switch for The Ritual's independent Mac edition.
// Keep this false while preparing catalog, artifacts, and production services.
// Publishing means filling the final Manager digest, changing this to true,
// running the release checks, and deploying this exact revision.
//
// Prices and plan names must match the live Paddle catalogue exactly
// (product "The Ritual": Monthly, Annual, Yours to keep). The apps read
// prices from the licensing service; this page is the shop window.
export const ritualCommerce = Object.freeze({
  releaseOpen: false,
  productName: 'The Ritual',
  edition: 'Independent Mac edition',
  supportedMacs: 2,
  // No timed trial (owner, 2026-10-12): without a plan The Ritual is free to use and every photograph carries the
  // Latent proof mark, on the canvas and in every export; a plan removes it.
  markedWithoutPlan: true,
  plans: Object.freeze([
    Object.freeze({
      id: 'monthly', name: 'Monthly', priceUsd: '14.99', cadence: 'month',
      note: 'Cancel any time.',
    }),
    Object.freeze({
      id: 'annual', name: 'Annual', priceUsd: '149.99', cadence: 'year',
      note: 'Two months free versus monthly.',
    }),
    Object.freeze({
      id: 'perpetual', name: 'Yours to keep', priceUsd: '599', cadence: null,
      note: 'Pay once. Every update to this version, free.',
    }),
  ]),
  manager: Object.freeze({
    version: '1.1.5',
    build: 238,
    downloadHref: '/download/manager',
    filename: 'Latent-Manager-1.1.5.zip',
    key: 'manager/latent-manager/production/1.1.5/Latent-Manager-1.1.5.zip',
    sha256: '58122b20760cf20582260d877698466a6307ced301aa8e74d3f4a01a9d77792c',
  }),
});
