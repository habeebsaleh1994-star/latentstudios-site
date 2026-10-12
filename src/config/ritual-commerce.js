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
  trialDays: 14,
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
    version: '1.1.0',
    build: 222,
    downloadHref: '/download/manager',
    filename: 'Latent-Manager-1.1.0.zip',
    key: 'manager/latent-manager/production/1.1.0/Latent-Manager-1.1.0.zip',
    sha256: '274b9f61c366cfdc616960c2bce9d160216865adaa6d41db15f158a1a533bf22',
  }),
});
