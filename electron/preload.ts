import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '@shared/types/ipc'
import type { ConfigKey } from '@shared/types/config'

const api: Omit<ElectronAPI, 'ready'> = {
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    getLabel: () => ipcRenderer.invoke('window:getLabel'),
    openConfig: (section) => ipcRenderer.invoke('window:openConfig', section),
    onConfigNavigate: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, section: string) => { callback(section); }
      ipcRenderer.on('config:navigate', handler)
      return () => { ipcRenderer.off('config:navigate', handler) }
    }
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  log: {
    getDir: () => ipcRenderer.invoke('log:getDir')
  },
  config: {
    get: (key) => ipcRenderer.invoke('config:get', key),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll'),
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
    openRecognize: (base64Image, text) => ipcRenderer.invoke('ocr:open-recognize', base64Image, text),
    sendToTranslate: (text) => ipcRenderer.invoke('ocr:send-to-translate', text),
    systemRecognize: (base64Image, lang) => ipcRenderer.invoke('ocr:system-recognize', base64Image, lang),
    onScreenshotShow: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, base64: string, mode: string) => { callback(base64, mode); }
      ipcRenderer.on('screenshot:show', handler)
      return () => { ipcRenderer.off('screenshot:show', handler) }
    },
    onRecognizeShow: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, base64: string, text: string) => { callback(base64, text); }
      ipcRenderer.on('recognize:show', handler)
      return () => { ipcRenderer.off('recognize:show', handler) }
    }
  },
  history: {
    add: (record) => ipcRenderer.invoke('history:add', record),
    list: (page, pageSize) => ipcRenderer.invoke('history:list', page, pageSize),
    count: () => ipcRenderer.invoke('history:count'),
    update: (id, sourceText, targetText) => ipcRenderer.invoke('history:update', id, sourceText, targetText),
    delete: (id) => ipcRenderer.invoke('history:delete', id),
    clear: () => ipcRenderer.invoke('history:clear')
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (name) => ipcRenderer.invoke('backup:restore', name)
  },
  dict: {
    lookup: (text, from, to) => ipcRenderer.invoke('dict:lookup', text, from, to),
    check: () => ipcRenderer.invoke('dict:check'),
    import: (url) => ipcRenderer.invoke('dict:import', url)
  },
  update: {
    onRelease: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, release: Parameters<typeof callback>[0]) => { callback(release); }
      ipcRenderer.on('updater:release', handler)
      return () => { ipcRenderer.off('updater:release', handler) }
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  ...api,
  ready: (label: string) => { ipcRenderer.send('renderer:ready', label); }
})
