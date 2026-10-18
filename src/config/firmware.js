// The Ritual for Canon 5D (2026-10-16): free firmware, pay what you want (owner's decision). $0 is the plain download
// here; $1 to $100 is a real software sale through Paddle, taken by the licensing service's own checkout
// (license.latentstudios.art/firmware, services/latent-licensing/src/firmware.ts in Latent-Print-Engine). Never
// worded as a donation or a pledge, and nothing is sold before the firmware ships.
//
// Release day, in this order: put the file behind `downloadHref`, set FIRMWARE_CHECKOUT=open and
// FIRMWARE_DOWNLOAD_URL on the licensing service, then turn `released` true here and deploy. Until then /firmware
// keeps its "get notified" form and no checkout exists anywhere.
export const firmware = Object.freeze({
  released: false,
  downloadHref: null,
  checkoutOrigin: 'https://license.latentstudios.art',
  amounts: Object.freeze([0, 10, 25, 50, 100]),
  suggested: 25,
  minimumUsd: 0,
  // Paid amounts start at $5 (owner, 18 Oct 2026): Paddle keeps about 5% + $0.50 of each payment.
  minimumPaidUsd: 5,
  maximumUsd: 100,
});

/// $0, or a whole number of dollars from $5 to $100; anything else is null.
export function firmwareAmount(value) {
  const amount = typeof value === 'number' ? value : /^\d{1,3}$/u.test(String(value ?? '').trim()) ? Number(String(value).trim()) : NaN;
  if (!Number.isSafeInteger(amount) || amount > firmware.maximumUsd) return null;
  return amount === 0 || amount >= firmware.minimumPaidUsd ? amount : null;
}

/// Where the buyer goes for an amount: $0 is the download itself, anything else Paddle's checkout at that amount.
export function firmwareDestination(amount, config = firmware) {
  const dollars = firmwareAmount(amount);
  if (dollars === null) return null;
  if (dollars === 0) return config.downloadHref;
  return `${config.checkoutOrigin}/firmware?amount=${dollars}`;
}
