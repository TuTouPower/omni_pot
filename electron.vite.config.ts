import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') }
    },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/main.ts') },
        external: [resolve(__dirname, 'src/main/selection/darwin'), resolve(__dirname, 'src/main/selection/windows')]
      }
    }
  },
  preload: {
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') }
    },
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/preload.ts') }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'src/shared')
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
