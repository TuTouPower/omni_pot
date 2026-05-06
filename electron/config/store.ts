import type { AppConfig, ConfigKey } from '@shared/types/config'
import { DEFAULT_CONFIG } from '@shared/types/config'

export function initConfigStore(): void {}
export function getConfig(_key: ConfigKey): unknown {
  return undefined
}
export function setConfig(_key: ConfigKey, _value: unknown): void {}
export function getAllConfig(): AppConfig {
  return { ...DEFAULT_CONFIG }
}
export function isFirstRun(): boolean {
  return false
}
