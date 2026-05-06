import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'
import { registerAllOcrServices } from './services/ocr'
import { useConfigStore } from './stores/config_store'
import i18n, { bindI18nToConfig } from './i18n'

async function bootstrap(): Promise<void> {
  registerAllServices()
  registerAllOcrServices()
  await useConfigStore.getState().loadConfig()
  bindI18nToConfig()

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

void bootstrap()
