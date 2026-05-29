import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, ChineseDictServiceState } from '@shared/types/ipc'
import type { ConfigKey } from '@shared/types/config'

const api: Omit<ElectronAPI, 'ready'> = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    setContentSize: (width, height) => ipcRenderer.invoke('window:setContentSize', width, height),
    setContentHeight: (height) => ipcRenderer.invoke('window:setContentHeight', height),
    getLabel: () => ipcRenderer.invoke('window:getLabel'),
    openConfig: (section) => ipcRenderer.invoke('window:openConfig', section),
    onConfigNavigate: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, section: string) => { callback(section); }
      ipcRenderer.on('config:navigate', handler)
      return () => { ipcRenderer.off('config:navigate', handler) }
    }
  },
  translate: {
    reportContentHeight: (height) => ipcRenderer.invoke('translate:reportContentHeight', height),
    reportMinWidth: (width) => ipcRenderer.invoke('translate:reportMinWidth', width),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  log: {
    getDir: () => ipcRenderer.invoke('log:getDir'),
    export: () => ipcRenderer.invoke('log:export'),
    write: (level: string, scope: string, message: string, ...args: unknown[]) =>
      ipcRenderer.invoke('log:write', level, scope, message, ...args),
  },
  config: {
    get: (key) => ipcRenderer.invoke('config:get', key),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll'),
    getUserDir: () => ipcRenderer.invoke('config:getUserDir'),
    onChange: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, key: ConfigKey, value: unknown) =>
        { callback(key, value); }
      ipcRenderer.on('config:changed', handler)
      return () => {
        ipcRenderer.off('config:changed', handler)
      }
    }
  },
  hotkey: {
    register: (name, shortcut) => ipcRenderer.invoke('hotkey:register', name, shortcut),
    unregister: (name, shortcut) => ipcRenderer.invoke('hotkey:unregister', name, shortcut)
  },
  text: {
    getSelection: () => ipcRenderer.invoke('text:getSelection'),
    writeClipboard: (text) => ipcRenderer.invoke('text:writeClipboard', text),
    write_clipboard_image: (base64_image) => ipcRenderer.invoke('text:write_clipboard_image', base64_image),
    onTranslateSelectionPending: (callback) => {
      const handler = () => { callback(); }
      ipcRenderer.on('translate:selection-pending', handler)
      return () => { ipcRenderer.off('translate:selection-pending', handler) }
    },
    onTranslateFromSelection: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, text: string) => { callback(text); }
      ipcRenderer.on('translate:from-selection', handler)
      return () => { ipcRenderer.off('translate:from-selection', handler) }
    },
    onTranslateSelectionEmpty: (callback) => {
      const handler = () => { callback(); }
      ipcRenderer.on('translate:selection-empty', handler)
      return () => { ipcRenderer.off('translate:selection-empty', handler) }
    },
    onInputTranslate: (callback) => {
      const handler = () => { callback(); }
      ipcRenderer.on('translate:input-translate', handler)
      return () => { ipcRenderer.off('translate:input-translate', handler) }
    },
    onTranslateFromApi: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, text: string) => { callback(text); }
      ipcRenderer.on('translate:from-api', handler)
      return () => { ipcRenderer.off('translate:from-api', handler) }
    },
    onTranslateFromClipboard: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, text: string) => { callback(text); }
      ipcRenderer.on('translate:from-clipboard', handler)
      return () => { ipcRenderer.off('translate:from-clipboard', handler) }
    },
    onDictLookup: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, text: string) => { callback(text); }
      ipcRenderer.on('dict:lookup', handler)
      return () => { ipcRenderer.off('dict:lookup', handler) }
    },
    onDictSelectionEmpty: (callback) => {
      const handler = () => { callback(); }
      ipcRenderer.on('dict:selection-empty', handler)
      return () => { ipcRenderer.off('dict:selection-empty', handler) }
    }
  },
  ocr: {
    captureScreenshot: (mode) => ipcRenderer.invoke('ocr:capture-screenshot', mode),
    open_recognize: (base64_image, text, mode) => ipcRenderer.invoke('ocr:open-recognize', base64_image, text, mode),
    sendToTranslate: (text) => ipcRenderer.invoke('ocr:send-to-translate', text),
    system_recognize: (base64_image, lang) => ipcRenderer.invoke('ocr:system-recognize', base64_image, lang),
    onScreenshotShow: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, base64: string, mode: string) => { callback(base64, mode); }
      ipcRenderer.on('screenshot:show', handler)
      return () => { ipcRenderer.off('screenshot:show', handler) }
    },
    onRecognizeShow: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, base64: string, text: string, mode: string) => { callback(base64, text, mode); }
      ipcRenderer.on('recognize:show', handler)
      return () => { ipcRenderer.off('recognize:show', handler) }
    }
  },
  history: {
    add: (record) => ipcRenderer.invoke('history:add', record),
    list: (page, pageSize, filters) => ipcRenderer.invoke('history:list', page, pageSize, filters),
    count: (filters) => ipcRenderer.invoke('history:count', filters),
    service_keys: () => ipcRenderer.invoke('history:service-keys'),
    update: (id, sourceText, targetText) => ipcRenderer.invoke('history:update', id, sourceText, targetText),
    delete: (id) => ipcRenderer.invoke('history:delete', id),
    clear: () => ipcRenderer.invoke('history:clear')
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    listWithSize: () => ipcRenderer.invoke('backup:list-with-size'),
    restore: (name) => ipcRenderer.invoke('backup:restore', name),
    import: () => ipcRenderer.invoke('backup:import'),
    delete: (name) => ipcRenderer.invoke('backup:delete', name),
    getPath: (name) => ipcRenderer.invoke('backup:get-path', name)
  },
  chinese_dict: {
    lookup: (text: string) => ipcRenderer.invoke('chinese_dict:lookup', text),
    check: () => ipcRenderer.invoke('chinese_dict:check'),
    reload: () => ipcRenderer.invoke('chinese_dict:reload'),
    onStateChanged: (callback: (state: ChineseDictServiceState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ChineseDictServiceState) => { callback(state); }
      ipcRenderer.on('chinese-dictionary:state-changed', handler)
      return () => { ipcRenderer.off('chinese-dictionary:state-changed', handler) }
    },
  },
  dict: {
    lookup: (text: string, from: string) => ipcRenderer.invoke('dict:lookup', text, from),
    check: () => ipcRenderer.invoke('dict:check'),
  },
  update: {
    onRelease: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, release: Parameters<typeof callback>[0]) => { callback(release); }
      ipcRenderer.on('updater:release', handler)
      return () => { ipcRenderer.off('updater:release', handler) }
    },
    downloadAndInstall: (asset) => ipcRenderer.invoke('updater:downloadAndInstall', asset),
    checkLatest: () => ipcRenderer.invoke('updater:checkLatest'),
    onDownloadProgress: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof callback>[0]) => { callback(progress); }
      ipcRenderer.on('updater:download-progress', handler)
      return () => { ipcRenderer.off('updater:download-progress', handler) }
    }
  },
  tray: {
    show: () => ipcRenderer.invoke('tray:show'),
    close: () => ipcRenderer.invoke('tray:close'),
    action: (action) => ipcRenderer.invoke('tray:action', action),
    labels: () => ipcRenderer.invoke('tray:labels'),
    clipboardMonitoring: () => ipcRenderer.invoke('tray:clipboard-monitoring'),
    popupReady: (width, height) => ipcRenderer.invoke('tray:popup-ready', width, height)
  },
  detect: {
    local: (text: string) => ipcRenderer.invoke('detect:local', text),
  },
}

contextBridge.exposeInMainWorld('electronAPI', {
  ...api,
  ready: (label: string) => { ipcRenderer.send('renderer:ready', label); }
})
