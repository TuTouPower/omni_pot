import type { ConfigKey, AppConfig } from './config'

export interface ElectronAPI {
  window: {
    close(): Promise<void>
    minimize(): Promise<void>
    maximize(): Promise<void>
    setAlwaysOnTop(flag: boolean): Promise<void>
    getLabel(): Promise<string>
  }
  config: {
    get(key: ConfigKey): Promise<unknown>
    set(key: ConfigKey, value: unknown): Promise<void>
    getAll(): Promise<AppConfig>
    onChange(callback: (key: ConfigKey, value: unknown) => void): () => void
  }
  hotkey: {
    register(name: string, shortcut: string): Promise<boolean>
    unregister(name: string, shortcut: string): Promise<void>
  }
  text: {
    getSelection(): Promise<string>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
