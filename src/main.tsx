import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { registerAllServices } from './services'
import { useConfigStore } from './stores/config_store'

async function bootstrap(): Promise<void> {
  registerAllServices()
  await useConfigStore.getState().loadConfig()

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

void bootstrap()
