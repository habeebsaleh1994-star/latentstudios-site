import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://latentritual.com',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => page !== 'https://latentritual.com/print-engine/beta/',
    }),
  ],
});
