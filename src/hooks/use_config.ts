import { useCallback } from 'react'
import { useConfigStore } from '../stores/config_store'
import type { AppConfig, ConfigKey } from '@shared/types/config'

export function useConfig<K extends ConfigKey>(
  key: K
): [AppConfig[K], (value: AppConfig[K]) => void] {
  const value = useConfigStore((s) => s.config[key])
  const setValue = useCallback(
    (newValue: AppConfig[K]) => { useConfigStore.getState().set(key, newValue); },
    [key]
  )
  return [value, setValue]
}
