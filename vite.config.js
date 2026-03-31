import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    base: './', // CRITICAL: Relative paths for Electron
    plugins: [
        react()
        // ====================================================
        // OBFUSCATION DISABLED - Causes runtime errors!
        // Using only Terser for minification (safer)
        // ====================================================
    ],
    server: {
        port: 5173
    },
    build: {
        outDir: 'dist',
        // ====================================================
        // TERSER - Safe Minification & Mangling
        // This provides good protection without breaking code
        // ====================================================
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,         // Remove console.log
                drop_debugger: true,        // Remove debugger
                pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
                passes: 2,                  // 2 passes for safety
                // DISABLED UNSAFE OPTIONS - They break React/Fabric
                unsafe: false,
                unsafe_comps: false,
                unsafe_math: false,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                ecma: 2020
            },
            mangle: {
                toplevel: false,            // Don't mangle top-level (safer)
                safari10: true,
                // DISABLED property mangling - breaks Fabric.js
                properties: false
            },
            format: {
                comments: false,            // Remove all comments
                ecma: 2020
            }
        },
        rollupOptions: {
            output: {
                manualChunks: undefined,    // Single file for Electron
                // Randomize output filenames for some protection
                entryFileNames: 'assets/[hash].js',
                chunkFileNames: 'assets/[hash].js',
                assetFileNames: 'assets/[hash][extname]'
            }
        },
        assetsDir: 'assets',
        emptyOutDir: true,
        sourcemap: false                    // No sourcemaps in production!
    }
});
