import { create } from 'zustand'
import type { AppConfig, ConfigKey } from '@shared/types/config'
import { DEFAULT_CONFIG } from '@shared/types/config'
import { create_logger } from '../utils/logger'

const log = create_logger('config_store')
let listenerRegistered = false

interface ConfigStore {
  config: AppConfig
  loaded: boolean
  loadConfig: () => Promise<void>
  get: <K extends ConfigKey>(key: K) => AppConfig[K]
  set: <K extends ConfigKey>(key: K, value: AppConfig[K]) => void
}

export const useConfigStore = create<ConfigStore>()((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,

  loadConfig: async () => {
    // Sync initial config so first render has data (no IPC round-trip)
    const initial = window.electronAPI.config.getInitial()
    set({ config: initial, loaded: true })

    // Then fetch latest from disk and merge
    const all = await window.electronAPI.config.getAll()
    set({ config: { ...DEFAULT_CONFIG, ...all }, loaded: true })

    if (!listenerRegistered) {
      listenerRegistered = true
      window.electronAPI.config.onChange((key, value) => {
        set((state) => ({
          config: { ...state.config, [key]: value }
        }))
      })
    }
  },

  get: (key) => get().config[key],

  set: (key, value) => {
    const prev = get().config[key]
    set((state) => ({
      config: { ...state.config, [key]: value }
    }))
    window.electronAPI.config.set(key, value).catch((err: unknown) => {
      log.error('config.set(%s) failed, reverting: %s', key, err instanceof Error ? err.message : String(err))
      set((state) => ({ config: { ...state.config, [key]: prev } }))
    })
  }
}))
