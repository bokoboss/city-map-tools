import { defineConfig } from 'vite';

// Proof module is built only by the test command; absent from normal production artifacts.
export default defineConfig({
  base: '/city-map-tools/',
  build: {
    lib: { entry: 'tests/directional-fixture.ts', formats: ['es'], fileName: '__directional_probe' },
    outDir: 'dist', emptyOutDir: false,
  },
});
