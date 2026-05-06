import type { TranslateService } from '@shared/types/service'

export class ServiceRegistry<T extends { readonly key: string }> {
  private services = new Map<string, T>()

  register(service: T): void {
    this.services.set(service.key, service)
  }

  get(key: string): T | undefined {
    return this.services.get(key)
  }

  getAll(): T[] {
    return Array.from(this.services.values())
  }

  getKeys(): string[] {
    return Array.from(this.services.keys())
  }
}

export const translateServiceRegistry = new ServiceRegistry<TranslateService>()
