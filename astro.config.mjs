import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { siteOrigin } from './src/config/site.js';

export default defineConfig({
  site: siteOrigin,
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return !['/print-engine/beta', '/checkout', '/moment/get'].includes(path)
          && !path.startsWith('/moment/get/');
      },
    }),
  ],
});
