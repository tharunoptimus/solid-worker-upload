import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        // the default entry point
        app: './index.html',

        // 1️⃣
        'workerHandlerSW': './src/sw/workerHandlerSW.ts',
      },
      output: {
        entryFileNames: assets => {

          if(assets.name === 'workerHandlerSW') {
            return 'serviceworkers/workerHandlerSW.js'
          }

          return '[name].js'
        }
      },
    }
  },
});
