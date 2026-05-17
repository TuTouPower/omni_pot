import { afterEach, describe, expect, it, vi } from 'vitest'
import { lingvaService } from '../../../src/services/lingva'

describe('lingvaService', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('rejects HTTP errors even when the body contains a translation field', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: () => Promise.resolve({ translation: 'bad gateway text' }),
        }))

        await expect(lingvaService.translate('hello', 'en', 'zh_cn', {}))
            .rejects.toThrow('Lingva API error: 502')
    })
})
