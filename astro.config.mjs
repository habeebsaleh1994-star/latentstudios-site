import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { siteOrigin } from './src/config/site.js';

export default defineConfig({
  site: siteOrigin,
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !['/print-engine/beta', '/checkout'].includes(new URL(page).pathname.replace(/\/$/, '')),
    }),
  ],
});
