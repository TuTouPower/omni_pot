import React, { useCallback, useRef, useState } from 'react'
import { Card, Button, Spinner } from '@heroui/react'
import { MdContentCopy, MdAutorenew, MdStarOutline, MdStar, MdExpandMore, MdExpandLess, MdDragIndicator } from 'react-icons/md'
import { TbTransformFilled } from 'react-icons/tb'
import { VscUnmute } from 'react-icons/vsc'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { collectionServiceRegistry } from '../../services/index'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'

interface TargetAreaProps {
  serviceList: string[]
  ttsServiceList: string[]
  onRetry?: (instanceKey: string) => void
}

interface SortableCardProps {
  instanceKey: string
  results: Record<string, string | DictResult | null | undefined>
  isTranslating: boolean
  collapsed: boolean
  onToggleCollapse: (key: string) => void
  sameTypeInstances: string[]
  onSwitchInstance: (oldKey: string, newKey: string) => void
  renderResult: (key: string) => React.ReactNode
}

function SortableCard({ instanceKey, results, collapsed, onToggleCollapse, sameTypeInstances, onSwitchInstance, renderResult }: SortableCardProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceKey })
  const serviceKey = getServiceKey(instanceKey)
  const service = translateServiceRegistry.get(serviceKey)
  if (!service) return null as unknown as React.ReactElement

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const result = results[instanceKey]
  const resultPreview = typeof result === 'string'
    ? result.substring(0, 50) + (result.length > 50 ? '...' : '')
    : null

  return (
    <div ref={setNodeRef} style={style}>
      <Card variant="bordered" className="shadow-none" data-result-key={instanceKey}>
        <Card.Header className="flex justify-between items-center px-3 py-1">
          <div className="flex items-center gap-1">
            <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <MdDragIndicator className="text-base text-default-300" />
            </span>
            <Button isIconOnly size="sm" variant="light" onPress={() => onToggleCollapse(instanceKey)}>
              {collapsed ? <MdExpandMore className="text-base" /> : <MdExpandLess className="text-base" />}
            </Button>
            <span className="text-xs font-semibold">{service.name}</span>
            {collapsed && resultPreview && (
              <span className="text-xs text-default-400 truncate max-w-40">{resultPreview}</span>
            )}
          </div>
          {sameTypeInstances.length > 1 && (
            <select
              value={instanceKey}
              onChange={(e) => onSwitchInstance(instanceKey, e.target.value)}
              className="text-xs bg-default-100 border border-default-200 rounded px-1 py-0.5 outline-none"
            >
              {sameTypeInstances.map((ik) => (
                <option key={ik} value={ik}>{ik.split('@')[1]}</option>
              ))}
            </select>
          )}
        </Card.Header>
        {!collapsed && (
          <Card.Content className="px-3 py-2">
            {renderResult(instanceKey)}
          </Card.Content>
        )}
      </Card>
    </div>
  )
}

export function TargetArea({ serviceList, ttsServiceList, onRetry }: TargetAreaProps): React.ReactElement {
  const results = useTranslateStore((s) => s.results)
  const isTranslating = useTranslateStore((s) => s.isTranslating)
  const sourceText = useTranslateStore((s) => s.sourceText)
  const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
  const targetLanguage = useTranslateStore((s) => s.targetLanguage)
  const setSourceText = useTranslateStore((s) => s.setSourceText)

  const collectionServiceList = useConfigStore((s) => s.config.collection_service_list)
  const serviceInstances = useConfigStore((s) => s.config.service_instances)

  const playingRef = useRef<HTMLAudioElement | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [collectedKeys, setCollectedKeys] = useState<Set<string>>(new Set())
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

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

  const handleCollect = useCallback(async (instanceKey: string) => {
    const result = results[instanceKey]
    if (!result || !sourceText.trim()) return

    const resultText = typeof result === 'string'
      ? result
      : (result as DictResult).definitions.map((d) => d.meanings.join('; ')).join('\n')

    for (const collInstanceKey of collectionServiceList) {
      const collKey = getServiceKey(collInstanceKey)
      const svc = collectionServiceRegistry.get(collKey)
      if (!svc) continue
      const cfg = serviceInstances[collInstanceKey]?.config ?? {}
      try {
        await svc.send(sourceText, sourceLanguage, targetLanguage, resultText, cfg)
      } catch { /* skip failed services */ }
    }

    setCollectedKeys((prev) => new Set(prev).add(instanceKey))
  }, [results, sourceText, sourceLanguage, targetLanguage, collectionServiceList, serviceInstances])

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
            {collectionServiceList.length > 0 && (
              <Button isIconOnly size="sm" variant="light" color={collectedKeys.has(instanceKey) ? 'warning' : 'default'} onPress={() => handleCollect(instanceKey)}>
                {collectedKeys.has(instanceKey) ? <MdStar className="text-base" /> : <MdStarOutline className="text-base" />}
              </Button>
            )}
          </div>
        </>
      )
    }

    // DictResult
    const dict = result as DictResult
    const dictText = dict.definitions.map((d) => d.meanings.join('; ')).join('\n')
    return (
      <div className="text-sm">
        {dict.definitions.map((def, i) => (
          <div key={i}>
            <span className="text-primary font-bold">{def.partOfSpeech}</span>{' '}
            {def.meanings.join('; ')}
          </div>
        ))}
        {collectionServiceList.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Button isIconOnly size="sm" variant="light" color={collectedKeys.has(instanceKey) ? 'warning' : 'default'} onPress={() => handleCollect(instanceKey)}>
              {collectedKeys.has(instanceKey) ? <MdStar className="text-base" /> : <MdStarOutline className="text-base" />}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const handleSwitchInstance = useCallback((oldInstanceKey: string, newInstanceKey: string) => {
    if (oldInstanceKey === newInstanceKey) return
    const list = useConfigStore.getState().config.translate_service_list
    const updated = list.map((k) => k === oldInstanceKey ? newInstanceKey : k)
    useConfigStore.getState().set('translate_service_list', updated)
  }, [])

  const allInstanceKeys = Object.keys(serviceInstances)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback((event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const list = useConfigStore.getState().config.translate_service_list
    const oldIdx = list.indexOf(String(active.id))
    const newIdx = list.indexOf(String(over.id))
    if (oldIdx === -1 || newIdx === -1) return
    const updated = [...list]
    const [moved] = updated.splice(oldIdx, 1)
    updated.splice(newIdx, 0, moved)
    useConfigStore.getState().set('translate_service_list', updated)
  }, [])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={serviceList} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
          {serviceList.map((instanceKey) => (
            <SortableCard
              key={instanceKey}
              instanceKey={instanceKey}
              results={results}
              isTranslating={isTranslating}
              collapsed={collapsedKeys.has(instanceKey)}
              onToggleCollapse={toggleCollapse}
              sameTypeInstances={allInstanceKeys.filter((k) => getServiceKey(k) === getServiceKey(instanceKey))}
              onSwitchInstance={handleSwitchInstance}
              renderResult={renderResult}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
