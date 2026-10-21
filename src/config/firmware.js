// The Ritual for Canon 5D (2026-10-16): free firmware, pay what you want (owner's decision). $0 is the plain download
// here; $1 to $100 is a real software sale through Paddle, taken by the licensing service's own checkout
// (license.latentstudios.art/firmware, services/latent-licensing/src/firmware.ts in Latent-Print-Engine). Never
// worded as a donation or a pledge, and nothing is sold before the firmware ships.
//
// Release day, in this order: put the file behind `downloadHref`, set FIRMWARE_CHECKOUT=open and
// FIRMWARE_DOWNLOAD_URL on the licensing service, then turn `released` true here and deploy. Until then /firmware
// keeps its "get notified" form and no checkout exists anywhere.
export const firmware = Object.freeze({
  released: true,
  downloadHref: '/firmware/download',
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

/// The four downloads of the first release (1.0, 20 Oct 2026, from the camera session): each carries the camera's 20
/// films (about 3.6 GB) with "How to use Ritual.txt" and LICENCE.txt inside. Served byte for byte from R2
/// (latent-software-releases) by functions/download/firmware/[file].js, only once `released` is true. A null sha256
/// means the file is not uploaded yet, and its door stays closed.
export const firmwareVersion = '1.0';
export const firmwareDownloads = Object.freeze([
  Object.freeze({ slug: 'mark-ii-mac', camera: 'Canon EOS 5D Mark II', os: 'Mac', filename: 'Ritual-for-5D-Mark-II-1.0.dmg',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Mark-II-1.0.dmg', bytes: 3567631531,
    sha256: '2187cacaf2d0c2d4185c048deb447c2468b058418dfb64ba006651d1d5079dca' }),
  Object.freeze({ slug: 'mark-ii-windows', camera: 'Canon EOS 5D Mark II', os: 'Windows', filename: 'Ritual-for-5D-Mark-II-1.0-Windows.zip',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Mark-II-1.0-Windows.zip', bytes: 3567367105,
    sha256: 'f9d4b67cf895cc011158e93e1e1a9b332ff1b7c04466a7f8d96ce70e6d64e81e' }),
  Object.freeze({ slug: 'classic-mac', camera: 'Canon EOS 5D', os: 'Mac', filename: 'Ritual-for-5D-Classic-1.0.dmg',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Classic-1.0.dmg', bytes: 3567532901,
    sha256: 'f094764b2bc596889e5f38808ec1f4e9e9fb123d1a07b3cbc90c32661d1a70ff' }),
  Object.freeze({ slug: 'classic-windows', camera: 'Canon EOS 5D', os: 'Windows', filename: 'Ritual-for-5D-Classic-1.0-Windows.zip',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Classic-1.0-Windows.zip', bytes: 3567287983,
    sha256: '5869e5e3ddd35ceb9c8e4f2cd97774190fca2591a58153dd301c09cedca03a51' }),
]);

/// What each camera needs before installing (from the camera session).
export const firmwareNeeds = Object.freeze({
  'Canon EOS 5D': 'Canon firmware 1.1.1, a full battery, and a CompactFlash card of 8 GB or more.',
  'Canon EOS 5D Mark II': 'Canon firmware 2.1.2, a full battery, and a CompactFlash card of 8 GB or more.',
});

