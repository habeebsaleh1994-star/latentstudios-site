// The Lab storefront. Latent Manager owns account-bound Paddle checkout and
// activation; the website owns the public product truth and installer door.
export const labCommerce = {
  // The store's one switch. Open it only with the release it sells behind /download/print-engine
  // (PRINT_ENGINE_RELEASE) and the Lab's status no longer "Coming soon" (truth.ts); the commercial
  // policy test holds the three together.
  storeOpen: true,
  // No timed trial: Print Engine is free to use with the Latent mark on the picture until a plan is chosen.
  yearlyUsd: 199,
  lifetimeUsd: 499,
  version: '1.1.9',
  downloadHref: '/download/print-engine',
  // How it installs: the steps, Send to Mac, and where the node sits in a grade. The Lab's Download buttons go
  // here with ?download, which starts the installer and keeps the steps in view.
  installHref: '/lab/install',
  // A sale on Lifetime, by a Paddle discount code (Paddle → Discounts). The site shows it until `endsAt`: a build
  // after that leaves it out, and pages built before it hide it in the visitor's browser at that moment.
  sale: {
    code: 'LATENTLAB25',
    percentOff: 25,
    lifetimeUsd: '374.25',
    endsAt: '2026-10-31T20:59:00Z', // 23:59 in Beirut
    endsLabel: '31 October',
  },
};

/// Whether the Lifetime sale is still on at build time.
export const labSaleOn = Date.now() < Date.parse(labCommerce.sale.endsAt);
