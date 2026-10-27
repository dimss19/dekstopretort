import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
        host: 'localhost',
        hmr: {
            host: 'localhost',
        },
    },
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        react(),
    ],
    test: {
        environment: 'jsdom',
        setupFiles: ['./resources/js/setupTests.ts'],
        globals: true,
        include: ['resources/js/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['nativephp/**', 'vendor/**', 'node_modules/**', 'dist/**'],
    },
});
