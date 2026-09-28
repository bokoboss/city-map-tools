import { defineConfig } from 'vite';

// Browser-smoke-only entry: the production app deliberately does not import #41 yet.
export default defineConfig({
  build: {
    lib: { entry: 'src/spatial/geodesic.ts', formats: ['es'], fileName: '__geodesic_probe' },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
