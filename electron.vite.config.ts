import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const build_app_dir = 'build/app'

export default defineConfig({
  main: {
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') }
    },
    build: {
      outDir: `${build_app_dir}/main`,
      emptyOutDir: true,
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
      outDir: `${build_app_dir}/preload`,
      emptyOutDir: false,
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
      outDir: `${build_app_dir}/renderer`,
      emptyOutDir: false,
      rollupOptions: {
        input: { index: resolve(__dirname, 'index.html') }
      }
    }
  }
})
