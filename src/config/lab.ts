// The Lab storefront. Latent Manager owns account-bound Paddle checkout and
// activation; the website owns the public product truth and installer door.
export const labCommerce = {
  // The store's one switch. Open it only with the release it sells behind /download/print-engine
  // (PRINT_ENGINE_RELEASE) and the Lab's status no longer "Coming soon" (truth.ts); the commercial
  // policy test holds the three together.
  storeOpen: true,
  trialDays: 7,
  yearlyUsd: 199,
  lifetimeUsd: 499,
  version: '1.1.3',
  downloadHref: '/download/print-engine',
};
