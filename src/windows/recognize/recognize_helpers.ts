import jsQR from 'jsqr'
import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { create_logger } from '../../utils/logger'

const log = create_logger('recognize')

export const QRCODE_INSTANCE_KEY = 'qrcode@default'

export function log_error(action: string, err: unknown): void {
    log.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

export async function try_qr_decode(base64: string): Promise<string | null> {
    const img = new Image()
    const data = await new Promise<ImageData>((resolve, reject) => {
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('canvas')); return }
            ctx.drawImage(img, 0, 0)
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
        }
        img.onerror = () => { reject(new Error('image')); }
        img.src = `data:image/png;base64,${base64}`
    })
    const code = jsQR(data.data, data.width, data.height)
    return code?.data ?? null
}
