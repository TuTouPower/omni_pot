import React, { useCallback, useEffect } from 'react'
import { Button } from '@heroui/react'
import { BsPinFill } from 'react-icons/bs'
import { AiFillCloseCircle } from 'react-icons/ai'
import { SourceArea } from './source_area'
import { LanguageArea } from './language_area'
import { TargetArea } from './target_area'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'

export default function TranslateWindow(): React.ReactElement {
  const sourceText = useTranslateStore((s) => s.sourceText)
  const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
  const targetLanguage = useTranslateStore((s) => s.targetLanguage)
  const setIsTranslating = useTranslateStore((s) => s.setIsTranslating)
  const setResult = useTranslateStore((s) => s.setResult)
  const clearResults = useTranslateStore((s) => s.clearResults)

  const serviceList = useConfigStore((s) => s.config.translate_service_list)
  const serviceInstances = useConfigStore((s) => s.config.service_instances)
  const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)
  const closeOnBlur = useConfigStore((s) => s.config.translate_close_on_blur)

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return

    setIsTranslating(true)
    clearResults()

    const promises = serviceList.map(async (instanceKey) => {
      const serviceKey = getServiceKey(instanceKey)
      const service = translateServiceRegistry.get(serviceKey)
      if (!service) {
        setResult(instanceKey, null)
        return
      }
      const instanceConfig = serviceInstances[instanceKey]?.config ?? {}

      try {
        const result = await service.translate(
          sourceText,
          sourceLanguage,
          targetLanguage,
          instanceConfig
        )
        setResult(instanceKey, result)
      } catch {
        setResult(instanceKey, null)
      }
    })

    await Promise.allSettled(promises)
    setIsTranslating(false)
  }, [sourceText, sourceLanguage, targetLanguage, serviceList, serviceInstances, setIsTranslating, setResult, clearResults])

  // Close on blur
  useEffect(() => {
    if (!closeOnBlur) return
    const handleBlur = () => window.electronAPI.window.close()
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [closeOnBlur])

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.electronAPI.window.close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClose = useCallback(() => window.electronAPI.window.close(), [])

  const handleToggleAlwaysOnTop = useCallback(() => {
    window.electronAPI.window.setAlwaysOnTop(!alwaysOnTop)
  }, [alwaysOnTop])

  return (
    <div className="flex flex-col h-screen select-none" style={{ fontSize: 16 }}>
      {/* Top bar */}
      <div className="flex justify-between items-center px-2 py-1 drag-region">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          color={alwaysOnTop ? 'primary' : 'default'}
          onPress={handleToggleAlwaysOnTop}
        >
          <BsPinFill />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
          <AiFillCloseCircle />
        </Button>
      </div>

      <SourceArea onTranslate={handleTranslate} />
      <LanguageArea />
      <TargetArea serviceList={serviceList} />
    </div>
  )
}
