import { defineConfig } from 'tsup';

export default defineConfig([
    // ESM and CJS builds - no banner, use proper module imports
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        clean: true,
        sourcemap: true,
        minify: false,
        // external: ['react', 'react-dom', '@pixodesk/svg-animator-web'],
        outExtension({ format }) {
            if (format === 'esm') return { js: '.js' };
            if (format === 'cjs') return { js: '.cjs' };
            return { js: '.js' };
        },
    },
    // IIFE/UMD build - uses window globals
    {
        entry: ['src/index.ts'],
        format: ['iife'],
        globalName: 'PixodeskAnimatorReact',
        dts: false,
        clean: false,
        sourcemap: true,
        minify: false,
        external: ['react', 'react-dom', '@pixodesk/svg-animator-web'],
        esbuildOptions(options) {
            options.banner = {
                js: `var React = window.React; var ReactDOM = window.ReactDOM; var PixodeskAnimatorWeb = window.PixodeskAnimator;`,
            };
        },
        outExtension() {
            return { js: '.umd.js' };
        },
    },
]);
