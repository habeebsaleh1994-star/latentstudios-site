// The Lab storefront — prices now, Paddle IDs when the installer ships.
// Fill the two price IDs from Paddle > Catalog > Prices. Until both are set,
// the lab page keeps the waitlist and does not open checkout.
export const labCommerce = {
  trialDays: 7,
  yearlyUsd: 199,
  lifetimeUsd: 499,
  paddleYearlyPriceId: '',
  paddleLifetimePriceId: '',
  publicPreviewHref: '/download/print-engine',
  waitlistHref: '/beta?app=lab',
};

export const labCheckoutReady = Boolean(
  labCommerce.paddleYearlyPriceId && labCommerce.paddleLifetimePriceId
);
