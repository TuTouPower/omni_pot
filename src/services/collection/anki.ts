import type { CollectionService } from '@shared/types/collection_service'

export const anki_service: CollectionService = {
    key: 'anki',
    name: 'Anki',
    config_fields: [
        { key: 'port', label: 'Port', type: 'number', default_value: 8765 }
    ],

    async send(word, _source, _target, result, config): Promise<void> {
        const port = Number(config.port) || 8765
        const res = await fetch(`http://localhost:${String(port)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'addNote',
                version: 6,
                params: {
                    note: {
                        deckName: 'Default',
                        modelName: 'Basic',
                        fields: { Front: word, Back: result },
                        tags: ['pot']
                    }
                }
            })
        })
        const data = (await res.json()) as { error?: string }
        if (data.error) {
            throw new Error(data.error)
        }
    }
}
