import type { ConfigKey, AppConfig } from './config'
import type { DictResult } from './service'
import type { LanguageCode } from './language'

export type ChineseDictServiceState = 'missing' | 'building' | 'ready' | 'failed'

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
    setContentSize(width: number, height: number): Promise<void>
    setContentHeight(height: number): Promise<void>
    getLabel(): Promise<string>
    openConfig(section?: string): Promise<void>
    onConfigNavigate(callback: (section: string) => void): () => void
  }
  shell: {
    openExternal(url: string): Promise<boolean>
  }
  log: {
    getDir(): Promise<string>
    export(): Promise<{ success: boolean; path?: string; error?: string }>
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
    openRecognize(base64Image: string, text: string, mode?: string): Promise<void>
    sendToTranslate(text: string): Promise<void>
    systemRecognize(base64Image: string, lang: string): Promise<string>
    onScreenshotShow(callback: (base64: string, mode: string) => void): () => void
    onRecognizeShow(callback: (base64: string, text: string, mode: string) => void): () => void
  }
  history: {
    add(record: Omit<HistoryRecord, 'id' | 'created_at'>): Promise<void>
    list(page: number, pageSize: number, filters?: { search?: string; service_key?: string; days?: number }): Promise<HistoryRecord[]>
    count(filters?: { search?: string; service_key?: string; days?: number }): Promise<number>
    update(id: number, sourceText: string, targetText: string): Promise<void>
    delete(id: number): Promise<void>
    clear(): Promise<void>
  }
  backup: {
    create(): Promise<{ success: boolean; path?: string; error?: string }>
    list(): Promise<string[]>
    listWithSize(): Promise<Array<{ name: string; size: number }>>
    restore(name: string): Promise<{ success: boolean; error?: string }>
    import(): Promise<{ success: boolean; restored_files?: string[]; error?: string }>
    delete(name: string): Promise<{ success: boolean; error?: string }>
    getPath(name: string): Promise<string>
  }
  dict: {
    lookup(text: string, from: string, to: string): Promise<DictResult | null>
    check(): Promise<{ ready: boolean; entry_count: number }>
    import(url?: string): Promise<{ success: boolean; entry_count?: number; error?: string }>
  }
  chineseDict: {
    lookup(text: string): Promise<DictResult | null>
    check(): Promise<{ ready: boolean; status: ChineseDictServiceState; entry_count: number }>
    reload(): Promise<{ success: boolean }>
    onStateChanged(callback: (state: ChineseDictServiceState) => void): () => void
  }
  update: {
    onRelease(callback: (release: {
      version: string
      current_version: string
      name: string
      body: string
      html_url: string
      published_at: string
      assets: Array<{ name: string; url: string; size?: number }>
    }) => void): () => void
    downloadAndInstall(asset: { name: string; url: string }): Promise<{ success: boolean; path?: string; error?: string }>
    onDownloadProgress(callback: (progress: { downloaded: number; total: number; percent: number }) => void): () => void
  }
  tray: {
    show(): Promise<boolean>
    close(): Promise<void>
    action(action: string): Promise<boolean>
    labels(): Promise<string[]>
    clipboardMonitoring(): Promise<boolean>
    popupReady(width: number, height: number): Promise<void>
  }
  detect: {
    local(text: string): Promise<{ lang: LanguageCode; source: 'cld3' | 'regex' }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
