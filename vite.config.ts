import { defineConfig } from 'vite';

export default defineConfig({
    base: '/salt_and_pepper/',
    server: {
        open: true,
        host: true
    },
    build: {
        sourcemap: true,
        outDir: 'dist'
    }
});
