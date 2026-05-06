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
    onTranslateFromSelection(callback: () => void): () => void
    onInputTranslate(callback: () => void): () => void
    onTranslateFromApi(callback: (text: string) => void): () => void
    onTranslateFromClipboard(callback: (text: string) => void): () => void
  }
  ocr: {
    captureScreenshot(mode: 'recognize' | 'translate'): Promise<void>
    openRecognize(base64Image: string, text: string): Promise<void>
    sendToTranslate(text: string): Promise<void>
    onScreenshotShow(callback: (base64: string, mode: string) => void): () => void
    onRecognizeShow(callback: (base64: string, text: string) => void): () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
