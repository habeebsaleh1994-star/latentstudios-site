// Purchases paused (owner, 2026-10-19): Paddle closed the account after an automated review, so no checkout can open
// until the next payment provider is live. The apps stay free to use with the Latent mark; a buyer who would have
// paid leaves an address instead, tagged by product, and hears the moment plans are back. `paused: false` takes the
// note down everywhere and puts the Lifetime sale line back on /lab.
export const purchases = Object.freeze({
  paused: true,
  label: 'Plans are paused',
  line: 'We are moving to a new payment provider, so plans can’t be bought for a short while.',
  ask: 'Leave your email and we’ll write the moment they’re back.',
  done: 'Thank you. We’ll write the moment plans are back.',
});

/// The free-use sentence for a product while plans are paused.
export const pausedFreeLine = (productName) => `${productName} is free to use with the Latent mark in the meantime.`;
