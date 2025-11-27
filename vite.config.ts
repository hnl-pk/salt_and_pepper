import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        open: true,
        host: true
    },
    build: {
        sourcemap: true,
        outDir: 'dist'
    }
});
