// The one publication switch for The Ritual's independent Mac edition.
// Keep this false while preparing catalog, artifacts, and production services.
// Publishing means filling the final Manager digest, changing this to true,
// running the release checks, and deploying this exact revision.
//
// Prices and plan names must match the live Paddle catalogue exactly
// (product "The Ritual": Monthly, Annual, Yours to keep). The apps read
// prices from the licensing service; this page is the shop window. The
// service's GET /v1/catalog needs a signed-in account session (2026-10-14),
// so the site cannot read it and keeps these values by hand.
export const ritualCommerce = Object.freeze({
  releaseOpen: true,
  productName: 'The Ritual',
  edition: 'Independent Mac edition',
  supportedMacs: 2,
  // No timed trial (owner, 2026-10-12): without a plan The Ritual is free to use and every photograph carries the
  // Latent proof mark, on the canvas and in every export; a plan removes it.
  markedWithoutPlan: true,
  plans: Object.freeze([
    Object.freeze({
      id: 'monthly', name: 'Monthly', priceUsd: '14.99', cadence: 'month', choose: 'Monthly, in Manager',
      note: 'Cancel any time.',
    }),
    Object.freeze({
      id: 'annual', name: 'Annual', priceUsd: '149.99', cadence: 'year', choose: 'Annual, in Manager',
      note: 'Two months free versus monthly.',
    }),
    Object.freeze({
      id: 'perpetual', name: 'Yours to keep', priceUsd: '599', cadence: null, choose: 'To keep, in Manager',
      note: 'Pay once. Every update to this version, free.',
    }),
  ]),
  manager: Object.freeze({
    version: '1.1.7',
    build: 242,
    downloadHref: '/download/manager',
    filename: 'Latent-Manager-1.1.7.dmg',
    key: 'manager/latent-manager/production/1.1.7/Latent-Manager-1.1.7.dmg',
    sha256: 'e4afb1470c55bfa3e7529110b301129160adf27d8703013559fbda7a5f072dcb',
  }),
});

// One plan by its id (`monthly`, `annual`, `perpetual`), or null for anything else.
export const ritualPlan = (id) => ritualCommerce.plans.find((plan) => plan.id === id) ?? null;

// "Annual · $149.99 a year", "Yours to keep · $599 once".
export const ritualPlanSummary = (plan) =>
  `${plan.name} · $${plan.priceUsd} ${plan.cadence ? `a ${plan.cadence}` : 'once'}`;

// Where a plan begins on the website, and where Manager opens on it.
export const ritualPurchasePath = (planId) =>
  ritualPlan(planId) ? `/ritual/purchase?plan=${planId}` : '/ritual/purchase';
export const ritualManagerPlanURL = (planId) => `latent-manager://ritual/plans?plan=${planId}`;
