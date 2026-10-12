// Release truth for editorial surfaces. Commercial publication remains owned
// by ritual-commerce.js so the page and protected download cannot disagree.
import { ritualCommerce } from './ritual-commerce.js';

export const truth = {
  ritualStatus: ritualCommerce.releaseOpen ? 'Available now' : 'Coming soon',
  ritualPlatformStatus: ritualCommerce.releaseOpen
    ? 'Available now for Mac · iPad to follow'
    : 'Mac and iPad · coming soon',
  labStatus: 'Available now',
  versosStatus: 'First call soon',
  ctaLabel: ritualCommerce.releaseOpen ? 'Get The Ritual' : 'Join the beta',
  showCommunity: true, // false hides the shared-world / Company sections
};
