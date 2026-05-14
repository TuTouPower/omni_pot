import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry, ocrServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { collectionServiceRegistry } from '../../services/index'
import { createServiceInstanceKey, getServiceKey } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { ConfigCard } from './config_components'

type ServiceCategory = 'translate_service_list' | 'dictionary_service_list' | 'recognize_service_list' | 'tts_service_list' | 'collection_service_list'

const CATEGORY_TABS = [
    { key: 'translate_service_list' as ServiceCategory, labelKey: 'service.translate', label: '翻译' },
    { key: 'dictionary_service_list' as ServiceCategory, labelKey: 'service.dictionary', label: '词典' },
    { key: 'recognize_service_list' as ServiceCategory, labelKey: 'service.ocr', label: '识别' },
    { key: 'tts_service_list' as ServiceCategory, labelKey: 'service.tts', label: '朗读' },
    { key: 'collection_service_list' as ServiceCategory, labelKey: 'service.collection', label: '收藏' },
]

function getRegistryForCategory(category: ServiceCategory) {
    switch (category) {
        case 'translate_service_list': return translateServiceRegistry
        case 'dictionary_service_list': return translateServiceRegistry
        case 'recognize_service_list': return ocrServiceRegistry
        case 'tts_service_list': return ttsServiceRegistry
        case 'collection_service_list': return collectionServiceRegistry
    }
}

export default function ServiceSettings(): React.ReactElement {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<ServiceCategory>('translate_service_list')
    const [showAddModal, setShowAddModal] = useState(false)

    const serviceList = useConfigStore((s) => s.config[activeTab])
    const serviceInstances = useConfigStore((s) => s.config.service_instances)

    const registry = getRegistryForCategory(activeTab)
    const availableServices = registry.getAll()

    const getInstanceName = (instanceKey: string): string => {
        const svcKey = getServiceKey(instanceKey)
        const svc = registry.get(svcKey)
        return svc ? svc.name : svcKey
    }

    const removeService = (instanceKey: string): void => {
        if (serviceList.length <= 1) return
        const newList = serviceList.filter((k) => k !== instanceKey)
        const newInstances: ServiceInstancesMap = { ...serviceInstances }
        delete newInstances[instanceKey]
        useConfigStore.getState().set(activeTab, newList)
        useConfigStore.getState().set('service_instances', newInstances)
    }

    const addService = (serviceKey: string): void => {
        const instanceKey = createServiceInstanceKey(serviceKey)
        const newList = [...serviceList, instanceKey]
        const newInstances: ServiceInstancesMap = {
            ...serviceInstances,
            [instanceKey]: { serviceKey, config: {} }
        }
        useConfigStore.getState().set(activeTab, newList)
        useConfigStore.getState().set('service_instances', newInstances)
        setShowAddModal(false)
    }

    const moveUp = (index: number): void => {
        if (index <= 0) return
        const newList = [...serviceList]
        const temp = newList[index]
        newList[index] = newList[index - 1]
        newList[index - 1] = temp
        useConfigStore.getState().set(activeTab, newList)
    }

    const moveDown = (index: number): void => {
        if (index >= serviceList.length - 1) return
        const newList = [...serviceList]
        const temp = newList[index]
        newList[index] = newList[index + 1]
        newList[index + 1] = temp
        useConfigStore.getState().set(activeTab, newList)
    }

    return (
        <div className="stack gap-12">
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-sunk)', borderRadius: 8, border: '1px solid var(--line)', alignSelf: 'flex-start' }}>
                {CATEGORY_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="btn sm"
                        style={{
                            background: activeTab === tab.key ? 'var(--bg-elev)' : 'transparent',
                            border: '1px solid ' + (activeTab === tab.key ? 'var(--line)' : 'transparent'),
                            boxShadow: activeTab === tab.key ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                            height: 26,
                        }}
                    >
                        {t(tab.labelKey) || tab.label}
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginLeft: 2 }}>
                            {serviceList.length}
                        </span>
                    </button>
                ))}
            </div>

            <div className="card">
                <div className="card-head">
                    <span>已启用服务</span>
                    <span className="hint mono" style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 'auto', fontWeight: 400 }}>拖动排序 · 顶部优先</span>
                </div>
                <div style={{ padding: 4 }}>
                    {serviceList.map((instanceKey, index) => {
                        const svcKey = getServiceKey(instanceKey)
                        return (
                            <div
                                key={instanceKey}
                                data-testid="svc-item"
                                data-service-key={instanceKey}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    transition: 'background .12s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Icons.Drag data-testid="svc-drag-handle" size={14} style={{ color: 'var(--text-mute)', cursor: 'grab' }} />
                                <div
                                    className="svc-tile"
                                    style={{ color: 'var(--text-dim)' }}
                                >
                                    {svcKey.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>{getInstanceName(instanceKey)}</div>
                                    <div className="hint mono" style={{ fontSize: 10.5 }}>{instanceKey}</div>
                                </div>
                                <button
                                    className="btn ghost icon sm"
                                    disabled={index === 0}
                                    onClick={() => moveUp(index)}
                                >
                                    <Icons.Chev size={12} style={{ transform: 'rotate(90deg)' }} />
                                </button>
                                <button
                                    className="btn ghost icon sm"
                                    disabled={index === serviceList.length - 1}
                                    onClick={() => moveDown(index)}
                                >
                                    <Icons.Chev size={12} style={{ transform: 'rotate(-90deg)' }} />
                                </button>
                                <button
                                    data-testid="svc-delete"
                                    className="btn ghost icon sm"
                                    style={{ color: serviceList.length <= 1 ? 'var(--text-mute)' : 'var(--danger)' }}
                                    disabled={serviceList.length <= 1}
                                    onClick={() => removeService(instanceKey)}
                                >
                                    <Icons.Trash size={13} />
                                </button>
                            </div>
                        )
                    })}
                </div>
                <div className="div" />
                <div style={{ padding: 10, display: 'flex', gap: 8 }}>
                    <button className="btn sm" data-testid="svc-add-btn" onClick={() => setShowAddModal(true)}>
                        <Icons.Plus size={12} />
                        {t('service.add') || '添加服务'}
                    </button>
                </div>
            </div>

            {/* Add service modal */}
            {showAddModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                    }}
                    onClick={() => setShowAddModal(false)}
                >
                    <div
                        className="card"
                        style={{ width: 400, maxHeight: 400, overflow: 'auto', padding: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-head">
                            <span>{t('service.add') || '添加服务'}</span>
                            <button className="ic-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowAddModal(false)}>
                                <Icons.Close size={13} />
                            </button>
                        </div>
                        <div style={{ padding: 4 }}>
                            {availableServices.map((svc) => (
                                <button
                                    key={svc.key}
                                    onClick={() => addService(svc.key)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        width: '100%',
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        border: 'none',
                                        fontSize: 13,
                                        color: 'var(--text)',
                                        fontFamily: 'inherit',
                                        transition: 'background .12s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    {svc.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
