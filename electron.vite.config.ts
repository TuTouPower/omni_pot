import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    resolve: {
      alias: { '@src/shared': resolve(__dirname, 'src/shared') }
    },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main.ts') },
        external: [resolve(__dirname, 'electron/selection/darwin'), resolve(__dirname, 'electron/selection/windows')]
      }
    }
  },
  preload: {
    resolve: {
      alias: { '@src/shared': resolve(__dirname, 'src/shared') }
    },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload.ts') }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@src/shared': resolve(__dirname, 'src/shared')
      },
      dedupe: ['react', 'react-dom']
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'index.html') }
      }
    }
  }
})
