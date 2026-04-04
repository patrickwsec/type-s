import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT || 3001);
  const hmrHost = env.VITE_HMR_HOST;

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      host: '0.0.0.0',
      port,
      hmr: hmrHost
        ? {
            protocol: env.VITE_HMR_PROTOCOL || 'ws',
            host: hmrHost,
            port: Number(env.VITE_HMR_PORT || port),
          }
        : undefined,
    },
    build: {
      outDir: 'dist',
    },
  };
});
