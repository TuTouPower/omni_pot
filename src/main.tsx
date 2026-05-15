import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'
import { useConfigStore } from './stores/config_store'
import type { AppConfig } from '@shared/types/config'
import { bindI18nToConfig } from './i18n'

const theme_query = window.matchMedia('(prefers-color-scheme: dark)')

function apply_theme(theme: AppConfig['app_theme']): void {
  const dark = theme === 'dark' || (theme === 'system' && theme_query.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = theme
}

function bind_theme_to_config(): void {
  apply_theme(useConfigStore.getState().config.app_theme)
  useConfigStore.subscribe((state, prev) => {
    if (state.config.app_theme !== prev.config.app_theme) {
      apply_theme(state.config.app_theme)
    }
  })
  theme_query.addEventListener('change', () => {
    if (useConfigStore.getState().config.app_theme === 'system') {
      apply_theme('system')
    }
  })
}

async function bootstrap(): Promise<void> {
  registerAllServices()

  await useConfigStore.getState().loadConfig()

  bindI18nToConfig()
  bind_theme_to_config()

  const root_element = document.getElementById('root')
  if (!root_element) {
    throw new Error('Root element not found')
  }

  createRoot(root_element).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap().catch(console.error)
