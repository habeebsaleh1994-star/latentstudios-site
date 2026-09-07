// Reserved for the future web storefront. Checkout is currently inactive.
// Before enabling purchases, approve latentstudios.art in Paddle and set its
// dashboard default payment link to this address, then verify a full checkout.
import { siteOrigin } from './site.js';
export const paddle = {
  clientToken: 'live_73d51053320609964135dd596a5',
  defaultPaymentUrl: new URL('/checkout', siteOrigin).href,
};
