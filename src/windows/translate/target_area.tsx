import React, { useCallback } from 'react'
import { Card, Button, TextArea, Spinner } from '@heroui/react'
import { MdContentCopy } from 'react-icons/md'
import { TbTransformFilled } from 'react-icons/tb'
import { useTranslateStore } from '../../stores/translate_store'
import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'

interface TargetAreaProps {
  serviceList: string[]
}

export function TargetArea({ serviceList }: TargetAreaProps): React.ReactElement {
  const results = useTranslateStore((s) => s.results)
  const isTranslating = useTranslateStore((s) => s.isTranslating)
  const setSourceText = useTranslateStore((s) => s.setSourceText)

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  const handleReverseTranslate = useCallback(
    (text: string) => {
      setSourceText(text)
    },
    [setSourceText]
  )

  const renderResult = (instanceKey: string) => {
    const result = results[instanceKey]

    if (isTranslating && result === undefined) {
      return <Spinner size="sm" color="primary" />
    }

    if (result === null) {
      return <p className="text-danger text-xs">Translation failed</p>
    }

    if (result === undefined) {
      return null
    }

    if (typeof result === 'string') {
      return (
        <>
          <TextArea
            value={result}
            isReadOnly
            className="text-sm"
          />
          <div className="flex items-center gap-1 mt-1">
            <Button isIconOnly size="sm" variant="light" onPress={() => handleCopy(result)}>
              <MdContentCopy className="text-base" />
            </Button>
            <Button isIconOnly size="sm" variant="light" onPress={() => handleReverseTranslate(result)}>
              <TbTransformFilled className="text-base" />
            </Button>
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
          <Card key={instanceKey} variant="bordered" className="shadow-none">
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
