import type { ConfigKey, AppConfig } from './config'
import type { DictResult } from './service'

export interface HistoryRecord {
    id: number
    service_key: string
    source_text: string
    source_lang: string
    target_text: string
    target_lang: string
    created_at: string
}

export interface HotkeyRegisterResult {
    success: boolean
    reason?: 'conflict' | 'invalid' | 'system'
}

export interface ElectronAPI {
  ready(label: string): void
  window: {
    close(): Promise<void>
    minimize(): Promise<void>
    maximize(): Promise<void>
    setAlwaysOnTop(flag: boolean): Promise<void>
    getLabel(): Promise<string>
    openConfig(section?: string): Promise<void>
    onConfigNavigate(callback: (section: string) => void): () => void
  }
  shell: {
    openExternal(url: string): Promise<boolean>
  }
  log: {
    getDir(): Promise<string>
  }
  config: {
    get(key: ConfigKey): Promise<unknown>
    set(key: ConfigKey, value: unknown): Promise<void>
    getAll(): Promise<AppConfig>
    onChange(callback: (key: ConfigKey, value: unknown) => void): () => void
  }
  hotkey: {
    register(name: string, shortcut: string): Promise<HotkeyRegisterResult>
    unregister(name: string, shortcut: string): Promise<void>
  }
  text: {
    getSelection(): Promise<string>
    writeClipboard(text: string): Promise<void>
    onTranslateFromSelection(callback: (text: string) => void): () => void
    onTranslateSelectionEmpty(callback: () => void): () => void
    onInputTranslate(callback: () => void): () => void
    onTranslateFromApi(callback: (text: string) => void): () => void
    onTranslateFromClipboard(callback: (text: string) => void): () => void
    onDictLookup(callback: (text: string) => void): () => void
    onDictSelectionEmpty(callback: () => void): () => void
  }
  ocr: {
    captureScreenshot(mode: 'recognize' | 'translate'): Promise<boolean>
    openRecognize(base64Image: string, text: string): Promise<void>
    sendToTranslate(text: string): Promise<void>
    systemRecognize(base64Image: string, lang: string): Promise<string>
    onScreenshotShow(callback: (base64: string, mode: string) => void): () => void
    onRecognizeShow(callback: (base64: string, text: string) => void): () => void
  }
  history: {
    add(record: Omit<HistoryRecord, 'id' | 'created_at'>): Promise<void>
    list(page: number, pageSize: number): Promise<HistoryRecord[]>
    count(): Promise<number>
    update(id: number, sourceText: string, targetText: string): Promise<void>
    delete(id: number): Promise<void>
    clear(): Promise<void>
  }
  backup: {
    create(): Promise<{ success: boolean; path?: string; error?: string }>
    list(): Promise<string[]>
    restore(name: string): Promise<{ success: boolean; error?: string }>
  }
  dict: {
    lookup(text: string, from: string, to: string): Promise<DictResult | null>
    check(): Promise<{ ready: boolean; entry_count: number }>
    import(url?: string): Promise<{ success: boolean; entry_count?: number; error?: string }>
  }
  update: {
    onRelease(callback: (release: {
      version: string
      current_version: string
      name: string
      body: string
      html_url: string
      published_at: string
      assets: Array<{ name: string; url: string }>
    }) => void): () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
