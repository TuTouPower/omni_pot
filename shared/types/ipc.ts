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
  getVersion(): Promise<string>
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
  translate: {
    reportContentHeight(height: number): Promise<void>
    reportMinWidth(width: number): Promise<void>
  }
  shell: {
    openExternal(url: string): Promise<boolean>
  }
  log: {
    getDir(): Promise<string>
    export(): Promise<{ success: boolean; path?: string; error?: string }>
    write(level: string, scope: string, message: string, ...args: unknown[]): Promise<void>
  }
  config: {
    get(key: ConfigKey): Promise<unknown>
    set(key: ConfigKey, value: unknown): Promise<void>
    getAll(): Promise<AppConfig>
    getUserDir(): Promise<string>
    onChange(callback: (key: ConfigKey, value: unknown) => void): () => void
  }
  hotkey: {
    register(name: string, shortcut: string): Promise<HotkeyRegisterResult>
    unregister(name: string, shortcut: string): Promise<void>
  }
  text: {
    getSelection(): Promise<string>
    writeClipboard(text: string): Promise<void>
    write_clipboard_image(base64_image: string): Promise<void>
    onTranslateSelectionPending(callback: () => void): () => void
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
    open_recognize(base64_image: string, text: string, mode?: string): Promise<void>
    sendToTranslate(text: string): Promise<void>
    system_recognize(base64_image: string, lang: string): Promise<string>
    onScreenshotShow(callback: (base64: string, mode: string) => void): () => void
    onRecognizeShow(callback: (base64: string, text: string, mode: string) => void): () => void
  }
  history: {
    add(record: Omit<HistoryRecord, 'id' | 'created_at'>): Promise<void>
    list(page: number, pageSize: number, filters?: { search?: string; service_key?: string; days?: number }): Promise<HistoryRecord[]>
    count(filters?: { search?: string; service_key?: string; days?: number }): Promise<number>
    service_keys(): Promise<string[]>
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
  chinese_dict: {
    lookup(text: string): Promise<DictResult | null>
    check(): Promise<{ ready: boolean; status: ChineseDictServiceState; entry_count: number }>
    reload(): Promise<{ success: boolean }>
    onStateChanged(callback: (state: ChineseDictServiceState) => void): () => void
  }
  dict: {
    lookup(text: string, from: string): Promise<DictResult | null>
    check(): Promise<{ ready: boolean; entry_count: number }>
  }
  update: {
    onRelease(callback: (release: {
      version: string
      current_version: string
      name: string
      body: string
      html_url: string
      published_at: string
      assets: Array<{ name: string; url: string; size?: number; digest?: string }>
    }) => void): () => void
    downloadAndInstall(asset_name: string): Promise<{ success: boolean; path?: string; error?: string }>
    checkLatest(): Promise<{ success: boolean; release?: {
      version: string
      current_version: string
      name: string
      body: string
      html_url: string
      published_at: string
      assets: Array<{ name: string; url: string; size?: number; digest?: string }>
    }; error?: string }>
    onDownloadProgress(callback: (progress: { downloaded: number; total: number; percent: number }) => void): () => void
  }
  tray: {
    show(): Promise<boolean>
    close(): Promise<void>
    action(action: 'input_translate' | 'dictionary' | 'ocr_recognize' | 'screenshot_translate' | 'clipboard_monitor' | 'config' | 'check_update' | 'view_log' | 'tray_click' | 'show_tray' | 'restart' | 'quit'): Promise<boolean>
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
