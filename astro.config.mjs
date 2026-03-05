import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://notes.josephmos.es',
  output: 'static',
  trailingSlash: 'always',
  adapter: netlify(),
});
