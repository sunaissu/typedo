import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlinePlugin } from './offlineBuild.js';
import { searchPlugin } from './searchBuild.js';

export default defineConfig({ plugins: [react(), searchPlugin({ origin: process.env.SITE_ORIGIN || '' }), offlinePlugin()] });
