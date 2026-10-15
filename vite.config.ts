/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    // Preload links resolve against the host page origin in content scripts, causing requests to the site.
    modulePreload: false,
  },
  test: {
    environment: 'jsdom',
  },
});
