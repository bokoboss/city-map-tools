import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Compile the real production entry unchanged. The separate observation entry shares
// MapLibre's module instance and is never imported by the normal production build.
export default defineConfig({
  base: '/city-map-tools/',
  plugins: [react()],
  build: {
    outDir: 'dist', emptyOutDir: false,
    rollupOptions: {
      input: { app: 'index.html', __traffic_probe: 'tests/traffic-product-probe.ts' },
      output: { entryFileNames: '[name].js' },
    },
  },
});
