import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'
import { registerAllOcrServices } from './services/ocr'
import { useConfigStore } from './stores/config_store'
import i18n, { bindI18nToConfig } from './i18n'

async function bootstrap(): Promise<void> {
  console.log('[renderer] bootstrap start')
  console.log('[renderer] location.hash:', window.location.hash)
  console.log('[renderer] electronAPI exists:', !!window.electronAPI)

  registerAllServices()
  console.log('[renderer] services registered')

  await useConfigStore.getState().loadConfig()
  console.log('[renderer] config loaded')

  bindI18nToConfig()
  console.log('[renderer] i18n bound')

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  console.log('[renderer] React root created')
}

void bootstrap()
