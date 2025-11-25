import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            'better-auth/react': path.resolve(__dirname, './node_modules/better-auth/dist/client/react/index.mjs'),
        },
    },
    server: {
        host: '0.0.0.0', // Listen on all interfaces for Docker
        port: 5173,
        allowedHosts: ['app1.local', 'app2.local', 'localhost'],
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
            '/.well-known': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
            '/users': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
            '/inbox': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
})
