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

/// The current release (1.1, 29 Oct 2026, from the camera session): per camera and computer, Make Ritual Card with the
/// camera's own files, "How to use Ritual.txt" and LICENCE.txt — under 1 MB; the films are each their own download
/// (firmwareFilms), added in Make Ritual Card. Served byte for byte from R2 (latent-software-releases) by
/// functions/download/firmware/[file].js, only once `released` is true. A null sha256 keeps that door closed.
export const firmwareVersion = '1.1';
export const firmwareDownloads = Object.freeze([
  Object.freeze({ slug: 'mark-ii-mac', camera: 'Canon EOS 5D Mark II', os: 'Mac', version: '1.1', filename: 'Ritual-for-5D-Mark-II-1.1.dmg',
    key: 'firmware/the-ritual-5d/1.1/Ritual-for-5D-Mark-II-1.1.dmg', bytes: 787357,
    sha256: '060032b56d731c2a80025ac226793dcaceeaa6a0f4b75f2914898775563d2dda' }),
  Object.freeze({ slug: 'mark-ii-windows', camera: 'Canon EOS 5D Mark II', os: 'Windows', version: '1.1', filename: 'Ritual-for-5D-Mark-II-1.1-Windows.zip',
    key: 'firmware/the-ritual-5d/1.1/Ritual-for-5D-Mark-II-1.1-Windows.zip', bytes: 335007,
    sha256: '57a58573c587c26a763c776805182e7feb2942b5d880fd3f10fc6e8475996d4f' }),
  Object.freeze({ slug: 'classic-mac', camera: 'Canon EOS 5D', os: 'Mac', version: '1.1', filename: 'Ritual-for-5D-Classic-1.1.dmg',
    key: 'firmware/the-ritual-5d/1.1/Ritual-for-5D-Classic-1.1.dmg', bytes: 636102,
    sha256: 'c1ade1012fdedfeb3b40dfbff15162b7cd47decb95dc902be681ff3614b760f8' }),
  Object.freeze({ slug: 'classic-windows', camera: 'Canon EOS 5D', os: 'Windows', version: '1.1', filename: 'Ritual-for-5D-Classic-1.1-Windows.zip',
    key: 'firmware/the-ritual-5d/1.1/Ritual-for-5D-Classic-1.1-Windows.zip', bytes: 185993,
    sha256: '917b7558f358de8401ed4c76931dff96257980aaa5a325ecfc98ad09088b679b' }),
]);

/// The first release (1.0, 20 Oct 2026), kept (owner, 29 Oct): each carries the camera's 20 films (about 3.6 GB).
export const firmwareEarlier = Object.freeze([
  Object.freeze({ slug: 'mark-ii-mac-1.0', camera: 'Canon EOS 5D Mark II', os: 'Mac', version: '1.0', filename: 'Ritual-for-5D-Mark-II-1.0.dmg',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Mark-II-1.0.dmg', bytes: 3567631531,
    sha256: '2187cacaf2d0c2d4185c048deb447c2468b058418dfb64ba006651d1d5079dca' }),
  Object.freeze({ slug: 'mark-ii-windows-1.0', camera: 'Canon EOS 5D Mark II', os: 'Windows', version: '1.0', filename: 'Ritual-for-5D-Mark-II-1.0-Windows.zip',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Mark-II-1.0-Windows.zip', bytes: 3567367105,
    sha256: 'f9d4b67cf895cc011158e93e1e1a9b332ff1b7c04466a7f8d96ce70e6d64e81e' }),
  Object.freeze({ slug: 'classic-mac-1.0', camera: 'Canon EOS 5D', os: 'Mac', version: '1.0', filename: 'Ritual-for-5D-Classic-1.0.dmg',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Classic-1.0.dmg', bytes: 3567532901,
    sha256: 'f094764b2bc596889e5f38808ec1f4e9e9fb123d1a07b3cbc90c32661d1a70ff' }),
  Object.freeze({ slug: 'classic-windows-1.0', camera: 'Canon EOS 5D', os: 'Windows', version: '1.0', filename: 'Ritual-for-5D-Classic-1.0-Windows.zip',
    key: 'firmware/the-ritual-5d/1.0/Ritual-for-5D-Classic-1.0-Windows.zip', bytes: 3567287983,
    sha256: '5869e5e3ddd35ceb9c8e4f2cd97774190fca2591a58153dd301c09cedca03a51' }),
]);

export { firmwareFilms } from './firmware-films.js';

/// What each camera needs before installing (from the camera session).
export const firmwareNeeds = Object.freeze({
  'Canon EOS 5D': 'Canon firmware 1.1.1, a full battery, and a CompactFlash card of 8 GB or more.',
  'Canon EOS 5D Mark II': 'Canon firmware 2.1.2, a full battery, and a CompactFlash card of 8 GB or more.',
});

