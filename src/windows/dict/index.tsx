import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Button, Spinner } from '@heroui/react'
import { AiFillCloseCircle } from 'react-icons/ai'
import { MdContentCopy } from 'react-icons/md'
import { BsPinFill } from 'react-icons/bs'
import { useDictStore } from '../../stores/dict_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'

function DictResultCard({ instanceKey, result }: { instanceKey: string; result: DictResult | null }): React.ReactElement | null {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)
    if (!service) return null

    if (result === null) {
        return (
            <Card variant="bordered" className="shadow-none">
                <Card.Header className="px-3 py-1">
                    <span className="text-xs font-semibold">{service.name}</span>
                </Card.Header>
                <Card.Content className="px-3 py-2">
                    <p className="text-danger text-xs">{t('dict.lookup_failed')}</p>
                </Card.Content>
            </Card>
        )
    }

    const handleCopy = () => {
        const text = result.definitions
            .map((d) => `${d.partOfSpeech} ${d.meanings.join('; ')}`)
            .join('\n')
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <Card variant="bordered" className="shadow-none" data-result-key={instanceKey}>
            <Card.Header className="flex justify-between px-3 py-1">
                <span className="text-xs font-semibold">{service.name}</span>
                <Button isIconOnly size="sm" variant="light" onPress={handleCopy}>
                    <MdContentCopy className={`text-base ${copied ? 'text-primary' : ''}`} />
                </Button>
            </Card.Header>
            <Card.Content className="px-3 py-2">
                {result.pronunciations.length > 0 && (
                    <div className="flex gap-3 mb-2">
                        {result.pronunciations.map((p, i) => (
                            <span key={i} className="text-xs text-default-400">
                                {p.region && `${p.region} `}{p.phonetic}
                            </span>
                        ))}
                    </div>
                )}
                {result.definitions.map((def, i) => (
                    <div key={i} className="mb-2">
                        <span className="text-xs font-bold text-primary mr-1">{def.partOfSpeech}</span>
                        <div className="ml-3">
                            {def.meanings.map((m, j) => (
                                <p key={j} className="text-sm">{j + 1}. {m}</p>
                            ))}
                        </div>
                    </div>
                ))}
                {result.examples.length > 0 && (
                    <div className="mt-2 border-t border-default-100 pt-2">
                        <p className="text-xs font-semibold text-default-400 mb-1">{t('dict.examples')}</p>
                        {result.examples.slice(0, 3).map((ex, i) => (
                            <p key={i} className="text-xs text-default-500 italic mb-1">{ex.source}</p>
                        ))}
                    </div>
                )}
            </Card.Content>
        </Card>
    )
}

export default function DictWindow(): React.ReactElement {
    const { t } = useTranslation()
    const word = useDictStore((s) => s.word)
    const results = useDictStore((s) => s.results)
    const isLoading = useDictStore((s) => s.isLoading)
    const setWord = useDictStore((s) => s.setWord)
    const setResult = useDictStore((s) => s.setResult)
    const setIsLoading = useDictStore((s) => s.setIsLoading)
    const clearResults = useDictStore((s) => s.clearResults)

    const serviceList = useConfigStore((s) => s.config.dictionary_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)

    const [dictReady, setDictReady] = useState<boolean | null>(null)
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        window.electronAPI.ready('dict')
    }, [])

    useEffect(() => {
        window.electronAPI.dict.check().then(({ ready }) => setDictReady(ready))
    }, [])

    const handleImport = useCallback(async () => {
        setImporting(true)
        const result = await window.electronAPI.dict.import()
        if (result.success) {
            setDictReady(true)
        }
        setImporting(false)
    }, [])

    const handleLookup = useCallback(async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed) return

        setWord(trimmed)
        setIsLoading(true)
        clearResults()

        const lookupWord = trimmed.split(' ')[0]

        const promises = serviceList.map(async (instanceKey) => {
            const serviceKey = getServiceKey(instanceKey)
            const service = translateServiceRegistry.get(serviceKey)
            if (!service) {
                setResult(instanceKey, null)
                return
            }
            const instanceConfig = serviceInstances[instanceKey]?.config ?? {}
            try {
                const result = await service.translate(lookupWord, 'en', 'zh_cn', instanceConfig)
                if (typeof result === 'object' && result.type === 'dict') {
                    setResult(instanceKey, result)
                } else {
                    setResult(instanceKey, null)
                }
            } catch {
                setResult(instanceKey, null)
            }
        })

        await Promise.allSettled(promises)
        setIsLoading(false)
    }, [serviceList, serviceInstances, setWord, setIsLoading, clearResults, setResult])

    useEffect(() => {
        const unsub = window.electronAPI.text.onDictLookup((text: string) => {
            if (!text.trim()) return
            handleLookup(text)
        })
        return unsub
    }, [handleLookup])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleClose = useCallback(() => window.electronAPI.window.close(), [])
    const handleTogglePin = useCallback(() => {
        window.electronAPI.window.setAlwaysOnTop(!alwaysOnTop)
    }, [alwaysOnTop])

    const handleManualLookup = useCallback(() => {
        if (word.trim()) handleLookup(word)
    }, [word, handleLookup])

    return (
        <div className="flex flex-col h-screen" style={{ fontSize: 16 }}>
            <div className="flex justify-between items-center px-2 py-1 drag-region">
                <Button isIconOnly size="sm" variant="light" color={alwaysOnTop ? 'primary' : 'default'} onPress={handleTogglePin}>
                    <BsPinFill />
                </Button>
                <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
                    <AiFillCloseCircle />
                </Button>
            </div>

            <div className="px-3 pb-2">
                <div className="flex gap-2">
                    <input
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleManualLookup() }}
                        placeholder={t('dict.source_placeholder')}
                        className="flex-1 px-3 py-1.5 rounded-md bg-default-100 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button size="sm" color="primary" onPress={handleManualLookup} isDisabled={!word.trim()}>
                        {t('dict.look_up')}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-2 px-2 overflow-y-auto flex-1">
                {dictReady === false && (
                    <Card variant="bordered" className="shadow-none">
                        <Card.Content className="px-3 py-3 text-center">
                            <p className="text-sm text-default-500 mb-2">CC-CEDICT dictionary not downloaded</p>
                            <Button size="sm" color="primary" onPress={handleImport} isLoading={importing}>
                                {importing ? 'Downloading...' : 'Download Dictionary (~6MB)'}
                            </Button>
                        </Card.Content>
                    </Card>
                )}
                {isLoading && Object.keys(results).length === 0 && (
                    <div className="flex justify-center py-4"><Spinner size="sm" color="primary" /></div>
                )}
                {serviceList.map((instanceKey) => {
                    const result = results[instanceKey]
                    if (result === undefined) return null
                    return <DictResultCard key={instanceKey} instanceKey={instanceKey} result={result} />
                })}
            </div>
        </div>
    )
}
