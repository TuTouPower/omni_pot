export interface CollectionService {
    readonly key: string
    readonly name: string
    readonly config_fields: readonly CollectionConfigField[]
    send(word: string, source: string, target: string, result: string, config: Record<string, unknown>): Promise<void>
}

export interface CollectionConfigField {
    readonly key: string
    readonly label: string
    readonly type: 'text' | 'number' | 'password'
    readonly default_value: string | number
}
