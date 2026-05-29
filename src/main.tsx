import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'
import { useConfigStore } from './stores/config_store'
import type { AppConfig, AppPrimaryColor } from '@shared/types/config'
import { bindI18nToConfig } from './i18n'
import { create_logger } from './utils/logger'

const log = create_logger('main')

const theme_query = window.matchMedia('(prefers-color-scheme: dark)')

function apply_primary_color(color: AppPrimaryColor): void {
  const root = document.documentElement
  root.style.setProperty('--brand-primary', color)
  root.style.setProperty('--brand-primary-hover', `color-mix(in oklab, ${color} 88%, black)`)
  root.style.setProperty('--brand-primary-soft', `color-mix(in oklab, ${color} 14%, transparent)`)
  root.dataset.primaryColor = color
}

function apply_transparent(transparent: boolean): void {
  document.documentElement.classList.toggle('transparent', transparent)
  document.documentElement.dataset.transparent = String(transparent)
}

function apply_theme(theme: AppConfig['app_theme']): void {
  const dark = theme === 'dark' || (theme === 'system' && theme_query.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = theme
}

function bind_theme_to_config(): void {
  const initial_config = useConfigStore.getState().config
  apply_theme(initial_config.app_theme)
  apply_primary_color(initial_config.app_primary_color)
  apply_transparent(initial_config.transparent)
  useConfigStore.subscribe((state, prev) => {
    if (state.config.app_theme !== prev.config.app_theme) {
      apply_theme(state.config.app_theme)
    }
    if (state.config.app_primary_color !== prev.config.app_primary_color) {
      apply_primary_color(state.config.app_primary_color)
    }
    if (state.config.transparent !== prev.config.transparent) {
      apply_transparent(state.config.transparent)
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

bootstrap().catch((err: unknown) => { log.error('bootstrap failed: %s', err instanceof Error ? err.message : String(err)) })
