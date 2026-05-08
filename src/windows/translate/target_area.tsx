import React, { useCallback, useRef, useState } from 'react'
import { Card, Button, Spinner } from '@heroui/react'
import { MdContentCopy, MdAutorenew } from 'react-icons/md'
import { TbTransformFilled } from 'react-icons/tb'
import { VscUnmute } from 'react-icons/vsc'
import { useTranslateStore } from '../../stores/translate_store'
import { translateServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'

interface TargetAreaProps {
  serviceList: string[]
  ttsServiceList: string[]
  onRetry?: (instanceKey: string) => void
}

export function TargetArea({ serviceList, ttsServiceList, onRetry }: TargetAreaProps): React.ReactElement {
  const results = useTranslateStore((s) => s.results)
  const isTranslating = useTranslateStore((s) => s.isTranslating)
  const targetLanguage = useTranslateStore((s) => s.targetLanguage)
  const setSourceText = useTranslateStore((s) => s.setSourceText)

  const playingRef = useRef<HTMLAudioElement | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  const handleReverseTranslate = useCallback(
    (text: string) => {
      setSourceText(text)
    },
    [setSourceText]
  )

  const handleTts = useCallback(async (text: string, key: string) => {
    if (playingRef.current) {
      playingRef.current.pause()
      playingRef.current = null
      setPlayingKey(null)
      return
    }

    const instanceKey = ttsServiceList[0]
    if (!instanceKey) return
    const svcKey = getServiceKey(instanceKey)
    const ttsService = ttsServiceRegistry.get(svcKey)
    if (!ttsService) return

    try {
      setPlayingKey(key)
      const audioBuffer = await ttsService.synthesize(text, targetLanguage, {})
      const blob = new Blob([audioBuffer], { type: 'audio/mp3' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      playingRef.current = audio
      audio.onended = () => {
        playingRef.current = null
        setPlayingKey(null)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        playingRef.current = null
        setPlayingKey(null)
        URL.revokeObjectURL(url)
      }
      audio.play()
    } catch {
      setPlayingKey(null)
    }
  }, [targetLanguage, ttsServiceList])

  const renderResult = (instanceKey: string) => {
    const result = results[instanceKey]

    if (isTranslating && result === undefined) {
      return <Spinner size="sm" color="primary" />
    }

    if (result === null) {
      return (
        <div className="flex items-center gap-2">
          <p className="text-danger text-xs">Translation failed</p>
          {onRetry && (
            <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => onRetry(instanceKey)}>
              <MdAutorenew className="text-base" />
            </Button>
          )}
        </div>
      )
    }

    if (result === undefined) {
      return null
    }

    if (typeof result === 'string') {
      return (
        <>
          <textarea
            value={result}
            readOnly
            rows={2}
            className="w-full bg-transparent border-none text-sm resize-none outline-none"
          />
          <div className="flex items-center gap-1 mt-1">
            <Button isIconOnly size="sm" variant="light" onPress={() => handleCopy(result)}>
              <MdContentCopy className="text-base" />
            </Button>
            <Button isIconOnly size="sm" variant="light" onPress={() => handleReverseTranslate(result)}>
              <TbTransformFilled className="text-base" />
            </Button>
            {ttsServiceList.length > 0 && (
              <Button isIconOnly size="sm" variant="light" color={playingKey === instanceKey ? 'primary' : 'default'} onPress={() => handleTts(result, instanceKey)}>
                <VscUnmute className="text-base" />
              </Button>
            )}
          </div>
        </>
      )
    }

    // DictResult
    const dict = result as DictResult
    return (
      <div className="text-sm">
        {dict.definitions.map((def, i) => (
          <div key={i}>
            <span className="text-primary font-bold">{def.partOfSpeech}</span>{' '}
            {def.meanings.join('; ')}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
      {serviceList.map((instanceKey) => {
        const serviceKey = getServiceKey(instanceKey)
        const service = translateServiceRegistry.get(serviceKey)
        if (!service) return null

        return (
          <Card key={instanceKey} variant="bordered" className="shadow-none" data-result-key={instanceKey}>
            <Card.Header className="flex justify-between px-3 py-1">
              <span className="text-xs font-semibold">{service.name}</span>
            </Card.Header>
            <Card.Content className="px-3 py-2">
              {renderResult(instanceKey)}
            </Card.Content>
          </Card>
        )
      })}
    </div>
  )
}
