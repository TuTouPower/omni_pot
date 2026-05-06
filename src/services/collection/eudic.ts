import type { CollectionService } from '@shared/types/collection_service'

export const eudic_service: CollectionService = {
    key: 'eudic',
    name: 'Eudic',
    config_fields: [
        { key: 'name', label: 'Notebook Name', type: 'text', default_value: 'pot' },
        { key: 'token', label: 'Token', type: 'password', default_value: '' }
    ],

    async send(word, _source, _target, _result, config): Promise<void> {
        const name = String(config.name) || 'pot'
        const token = String(config.token) || ''
        if (!token) {
            throw new Error('Eudic token is required')
        }
        const res = await fetch('https://api.frdic.com/api/open/v1/vocabulary/words', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                word,
                language: 'en'
            })
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(`Eudic API error: ${text}`)
        }
    }
}
