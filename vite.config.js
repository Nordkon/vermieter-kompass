import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const explicitBase = process.env.VITE_BASE_PATH?.trim();
const githubPagesBase = repositoryName && !repositoryName.endsWith('.github.io')
  ? `/${repositoryName}/`
  : '/';

export default defineConfig({
  // Lokal bleibt die App unter /. In GitHub Actions wird der Repository-Pfad
  // automatisch verwendet, damit auch Projektseiten und ihre Assets funktionieren.
  base: explicitBase || (process.env.GITHUB_ACTIONS === 'true' ? githubPagesBase : '/'),
  plugins: [react()],
  server: {
    port: 4173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
