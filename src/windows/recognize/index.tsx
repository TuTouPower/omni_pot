import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { BsPinFill } from 'react-icons/bs'
import { AiFillCloseCircle, AiOutlineCopy } from 'react-icons/ai'
import { HiTranslate } from 'react-icons/hi'
import { LuDelete } from 'react-icons/lu'
import { MdSmartButton, MdAutorenew } from 'react-icons/md'
import { useConfigStore } from '../../stores/config_store'
import { ocrServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'

export default function RecognizeWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [imageBase64, setImageBase64] = useState<string>('')
    const [recognizedText, setRecognizedText] = useState<string>('')
    const [alwaysOnTop, setAlwaysOnTop] = useState(false)
    const [selectedService, setSelectedService] = useState<string>('')
    const [selectedLanguage, setSelectedLanguage] = useState<string>('auto')
    const [isRecognizing, setIsRecognizing] = useState(false)

    const config = useConfigStore((s) => s.config)

    useEffect(() => {
        window.electronAPI.ready('recognize')
    }, [])

    useEffect(() => {
        const unsub = window.electronAPI.ocr.onRecognizeShow((base64, text) => {
            setImageBase64(base64)
            setRecognizedText(text)
        })
        return unsub
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const service_list = config.recognize_service_list
    const service_instances = config.service_instances

    const handleRecognize = useCallback(async () => {
        if (!imageBase64) return
        setIsRecognizing(true)

        const lang = (selectedLanguage || config.recognize_language) as LanguageCode
        const instance_key = selectedService || service_list[0]
        if (!instance_key) {
            setIsRecognizing(false)
            return
        }

        const svc_key = getServiceKey(instance_key)
        const service = ocrServiceRegistry.get(svc_key)
        if (!service) {
            setIsRecognizing(false)
            return
        }

        const instance_config: ServiceConfig = service_instances[instance_key]?.config ?? {}
        try {
            const result = await service.recognize(imageBase64, lang, instance_config)
            setRecognizedText(result || '')
        } catch {
            // keep existing text on failure
        }
        setIsRecognizing(false)
    }, [imageBase64, selectedService, selectedLanguage, service_list, service_instances, config.recognize_language])

    const handleCopy = useCallback(async () => {
        if (recognizedText) {
            await navigator.clipboard.writeText(recognizedText)
        }
    }, [recognizedText])

    const handleTranslate = useCallback(async () => {
        if (recognizedText) {
            await window.electronAPI.ocr.sendToTranslate(recognizedText)
        }
    }, [recognizedText])

    const handleDeleteNewline = useCallback(() => {
        setRecognizedText(recognizedText.replace(/-\s+/g, '').replace(/\s+/g, ' '))
    }, [recognizedText])

    const handleDeleteAllSpaces = useCallback(() => {
        setRecognizedText(recognizedText.replace(/\s+/g, ''))
    }, [recognizedText])

    const handleClose = useCallback(() => {
        window.electronAPI.window.close()
    }, [])

    const handleTogglePin = useCallback(() => {
        const next = !alwaysOnTop
        setAlwaysOnTop(next)
        window.electronAPI.window.setAlwaysOnTop(next)
    }, [alwaysOnTop])

    return (
        <div className="flex flex-col h-screen select-none">
            {/* Title bar */}
            <div className="flex justify-between items-center px-2 py-1">
                <div className="flex items-center gap-1">
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color={alwaysOnTop ? 'primary' : 'default'}
                        onPress={handleTogglePin}
                    >
                        <BsPinFill />
                    </Button>
                    <span className="text-sm font-medium text-default-600">{t('recognize.title')}</span>
                </div>
                <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
                    <AiFillCloseCircle />
                </Button>
            </div>

            {/* Image preview */}
            {imageBase64 && (
                <div className="px-2 pb-2">
                    <img
                        src={`data:image/png;base64,${imageBase64}`}
                        alt="captured"
                        className="max-h-32 w-auto rounded border border-default-200"
                    />
                </div>
            )}

            {/* Editable text */}
            <div className="flex-1 px-2 pb-2 overflow-auto">
                <textarea
                    value={recognizedText}
                    onChange={(e) => setRecognizedText(e.target.value)}
                    placeholder={t('recognize.no_result')}
                    className="w-full h-full text-sm whitespace-pre-wrap break-words font-mono text-default-700 bg-default-50 rounded p-2 border border-default-200 outline-none resize-none"
                />
            </div>

            {/* Service & Language selectors */}
            <div className="flex items-center gap-2 px-2 pb-1">
                <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="text-xs bg-default-100 border border-default-200 rounded px-2 py-1 max-w-[140px]"
                >
                    <option value="">{t('recognize.service')}</option>
                    {service_list.map((k) => {
                        const svc = ocrServiceRegistry.get(getServiceKey(k))
                        return <option key={k} value={k}>{svc?.name ?? getServiceKey(k)}</option>
                    })}
                </select>
                <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="text-xs bg-default-100 border border-default-200 rounded px-2 py-1 max-w-[100px]"
                >
                    {LANGUAGE_CODES.map((code) => (
                        <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>
                    ))}
                </select>
                <Button
                    size="sm"
                    variant="flat"
                    startContent={<MdAutorenew />}
                    onPress={handleRecognize}
                    isDisabled={!imageBase64 || isRecognizing || service_list.length === 0}
                    isLoading={isRecognizing}
                >
                    {t('recognize.re_recognize')}
                </Button>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between px-2 pb-2 gap-1">
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="light"
                        onPress={handleDeleteNewline}
                        isDisabled={!recognizedText}
                    >
                        <MdSmartButton className="text-base" />
                    </Button>
                    <Button
                        size="sm"
                        variant="light"
                        onPress={handleDeleteAllSpaces}
                        isDisabled={!recognizedText}
                    >
                        <LuDelete className="text-base" />
                    </Button>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="flat"
                        startContent={<HiTranslate />}
                        onPress={handleTranslate}
                        isDisabled={!recognizedText}
                    >
                        {t('recognize.translate')}
                    </Button>
                    <Button
                        size="sm"
                        variant="flat"
                        startContent={<AiOutlineCopy />}
                        onPress={handleCopy}
                        isDisabled={!recognizedText}
                    >
                        {t('copy')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
