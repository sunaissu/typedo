import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlinePlugin } from './offlineBuild.js';

export default defineConfig({ plugins: [react(), offlinePlugin()] });
