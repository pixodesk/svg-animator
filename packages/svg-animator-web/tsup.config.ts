import { defineConfig } from 'tsup';

export default defineConfig([
    // Non-minified build (with source maps)
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs', 'iife'],
        globalName: 'PixodeskAnimator',
        dts: true,
        clean: true,
        sourcemap: true,
        minify: false,
        outExtension({ format }) {
            if (format === 'esm') return { js: '.js' };
            if (format === 'cjs') return { js: '.cjs' };
            if (format === 'iife') return { js: '.umd.js' };
            return { js: '.js' };
        },
    },
    // Minified build (no source maps)
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs', 'iife'],
        globalName: 'PixodeskAnimator',
        dts: false,
        clean: false,
        sourcemap: false,
        minify: 'terser',
        outExtension({ format }) {
            if (format === 'esm') return { js: '.min.js' };
            if (format === 'cjs') return { js: '.min.cjs' };
            if (format === 'iife') return { js: '.umd.min.js' };
            return { js: '.min.js' };
        },
    },
]);
