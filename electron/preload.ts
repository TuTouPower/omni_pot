import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '@shared/types/ipc'
import type { ConfigKey } from '@shared/types/config'

const api: ElectronAPI = {
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    getLabel: () => ipcRenderer.invoke('window:getLabel')
  },
  config: {
    get: (key) => ipcRenderer.invoke('config:get', key),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll'),
    onChange: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, key: ConfigKey, value: unknown) =>
        callback(key, value)
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
    getSelection: () => ipcRenderer.invoke('text:getSelection')
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
