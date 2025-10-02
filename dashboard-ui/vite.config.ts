import { defineConfig, loadEnv, ConfigEnv, UserConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from 'tailwindcss';

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  const dashboardServerUrl: string = env.VITE_DASHBOARD_SERVER_URL || 'http://localhost:3001';

  return {
    plugins: [solid()],
    root: '.',
    publicDir: false,
    build: {
      outDir: './dist',
      emptyOutDir: true,
    },
    css: {
      postcss: {
        plugins: [tailwindcss],
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/mcp': dashboardServerUrl,
        '/api': dashboardServerUrl,
        '/info': dashboardServerUrl,
        '/health': dashboardServerUrl,
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test-setup.ts',
    }
  };
});