import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'LLM Form Assistant',
  version: pkg.version,
  description: 'Per-tab chat that helps fill forms and supports decisions using an LLM backend.',
  action: { default_title: 'Toggle assistant' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  options_page: 'src/options/index.html',
  // `debugger` captures the full-page screenshot through the DevTools protocol.
  permissions: ['storage', 'debugger'],
  host_permissions: ['<all_urls>'],
  // Requested at runtime for the configured backend origin only.
  optional_host_permissions: ['http://*/*', 'https://*/*'],
});
