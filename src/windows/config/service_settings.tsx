import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Icons } from '../../components/icons'
import { useConfigStore } from '../../stores/config_store'
import { getServiceKey, createServiceInstanceKey } from '@shared/types/service'
import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { ServiceItemRow } from './service_item_row'
import {
    CATEGORY_TABS,
    type ServiceCategory,
    getRegistryForCategory,
    service_has_test_config,
    visible_config_text,
    parse_config_text,
    get_service_config,
} from './service_settings_helpers'

export default function ServiceSettings(): React.ReactElement {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<ServiceCategory>('translate_service_list')
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const editing_key_ref = useRef<string | null>(null)
    const edit_test_request_ref = useRef(0)
    const [editName, setEditName] = useState('')
    const [editConfigText, setEditConfigText] = useState('{}')
    const [editStatus, setEditStatus] = useState('')

    const serviceList = useConfigStore((s) => s.config[activeTab])
    const serviceInstances = useConfigStore((s) => s.config.service_instances)

    const categoryCounts = {
        translate_service_list: useConfigStore((s) => s.config.translate_service_list.length),
        dictionary_service_list: useConfigStore((s) => s.config.dictionary_service_list.length),
        english_dictionary_service_list: useConfigStore((s) => s.config.english_dictionary_service_list.length),
        recognize_service_list: useConfigStore((s) => s.config.recognize_service_list.length),
        tts_service_list: useConfigStore((s) => s.config.tts_service_list.length),
    }

    const registry = getRegistryForCategory(activeTab)
    const availableServices = registry.getAll()
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const getInstanceName = (instanceKey: string): string => {
        const customName = get_service_config(serviceInstances, instanceKey).instanceName
        if (typeof customName === 'string' && customName.trim()) return customName
        const svcKey = getServiceKey(instanceKey)
        const svc = registry.get(svcKey)
        return svc ? svc.name : svcKey
    }

    const setServiceInstances = (newInstances: ServiceInstancesMap): void => {
        useConfigStore.getState().set('service_instances', newInstances)
    }

    const updateServiceConfig = (instanceKey: string, nextConfig: ServiceConfig): void => {
        const currentInstance = (serviceInstances as Partial<ServiceInstancesMap>)[instanceKey] ?? { serviceKey: getServiceKey(instanceKey), config: {} }
        setServiceInstances({
            ...serviceInstances,
            [instanceKey]: {
                ...currentInstance,
                config: nextConfig,
            }
        })
    }

    const toggleService = (instanceKey: string): void => {
        const currentConfig = get_service_config(serviceInstances, instanceKey)
        updateServiceConfig(instanceKey, {
            ...currentConfig,
            enable: currentConfig.enable === false,
        })
    }

    const removeService = (instanceKey: string): void => {
        if (serviceList.length <= 1) return
        const newList = serviceList.filter((k) => k !== instanceKey)
        const { [instanceKey]: removed, ...newInstances } = serviceInstances
        void removed
        useConfigStore.getState().set(activeTab, newList)
        setServiceInstances(newInstances)
    }

    const addService = (serviceKey: string): void => {
        const instanceKey = createServiceInstanceKey(serviceKey)
        const newList = [...serviceList, instanceKey]
        const newInstances: ServiceInstancesMap = {
            ...serviceInstances,
            [instanceKey]: { serviceKey, config: {} }
        }
        useConfigStore.getState().set(activeTab, newList)
        setServiceInstances(newInstances)
        setShowAddModal(false)
    }

    const handleDragEnd = (event: DragEndEvent): void => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = serviceList.indexOf(String(active.id))
        const newIndex = serviceList.indexOf(String(over.id))
        if (oldIndex === -1 || newIndex === -1) return
        const newList = [...serviceList]
        const [moved] = newList.splice(oldIndex, 1) as [string]
        newList.splice(newIndex, 0, moved)
        useConfigStore.getState().set(activeTab, newList)
    }

    const moveUp = (instanceKey: string): void => {
        const idx = serviceList.indexOf(instanceKey)
        if (idx <= 0) return
        const newList = [...serviceList]
        const [moved] = newList.splice(idx, 1) as [string]
        newList.splice(idx - 1, 0, moved)
        useConfigStore.getState().set(activeTab, newList)
    }

    const moveDown = (instanceKey: string): void => {
        const idx = serviceList.indexOf(instanceKey)
        if (idx < 0 || idx >= serviceList.length - 1) return
        const newList = [...serviceList]
        const [moved] = newList.splice(idx, 1) as [string]
        newList.splice(idx + 1, 0, moved)
        useConfigStore.getState().set(activeTab, newList)
    }

    const openEdit = (instanceKey: string): void => {
        const config = get_service_config(serviceInstances, instanceKey)
        editing_key_ref.current = instanceKey
        edit_test_request_ref.current += 1
        setEditingKey(instanceKey)
        setEditName(typeof config.instanceName === 'string' ? config.instanceName : '')
        setEditConfigText(visible_config_text(config))
        setEditStatus('')
    }

    const closeEdit = (): void => {
        editing_key_ref.current = null
        edit_test_request_ref.current += 1
        setEditingKey(null)
        setEditStatus('')
    }

    const update_edit_name = (value: string): void => {
        edit_test_request_ref.current += 1
        setEditName(value)
        setEditStatus('')
    }

    const update_edit_config_text = (value: string): void => {
        edit_test_request_ref.current += 1
        setEditConfigText(value)
        setEditStatus('')
    }

    const buildEditedConfig = (): ServiceConfig | null => {
        try {
            const parsed = parse_config_text(editConfigText)
            if (!parsed || !editingKey) return null
            const currentConfig = get_service_config(serviceInstances, editingKey)
            const name = editName.trim()
            return {
                ...parsed,
                ...(typeof currentConfig.enable === 'boolean' ? { enable: currentConfig.enable } : {}),
                ...(name ? { instanceName: name } : {}),
            }
        } catch {
            return null
        }
    }

    const saveEdit = (): void => {
        if (!editingKey) return
        const nextConfig = buildEditedConfig()
        if (!nextConfig) {
            setEditStatus(t('service.invalid_config'))
            return
        }
        updateServiceConfig(editingKey, nextConfig)
        closeEdit()
    }

    const testEdit = async (): Promise<void> => {
        if (!editingKey) return
        const tested_key = editingKey
        const test_request_id = edit_test_request_ref.current + 1
        edit_test_request_ref.current = test_request_id
        const nextConfig = buildEditedConfig()
        if (!nextConfig) {
            setEditStatus(t('service.invalid_config'))
            return
        }
        const serviceKey = getServiceKey(tested_key)
        const service = registry.get(serviceKey)
        if (!service_has_test_config(service)) {
            setEditStatus(t('service.test_unavailable'))
            return
        }
        setEditStatus(t('service.testing'))
        try {
            const ok = await service.testConfig(nextConfig)
            if (editing_key_ref.current !== tested_key || edit_test_request_ref.current !== test_request_id) return
            setEditStatus(ok ? t('service.test_success') : t('service.test_failed'))
        } catch {
            if (editing_key_ref.current !== tested_key || edit_test_request_ref.current !== test_request_id) return
            setEditStatus(t('service.test_failed'))
        }
    }

    return (
        <div className="stack gap-12">
            <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-sunk)', borderRadius: 8, border: '1px solid var(--line)', alignSelf: 'flex-start' }}>
                {CATEGORY_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        role="tab"
                        data-testid={`svc-tab-${tab.key}`}
                        aria-selected={activeTab === tab.key}
                        onClick={() => { setActiveTab(tab.key); }}
                        className="btn sm"
                        style={{
                            background: activeTab === tab.key ? 'var(--bg-elev)' : 'transparent',
                            border: '1px solid ' + (activeTab === tab.key ? 'var(--line)' : 'transparent'),
                            boxShadow: activeTab === tab.key ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                            height: 26,
                        }}
                    >
                        {t(tab.labelKey, { defaultValue: tab.label })}
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginLeft: 2 }}>
                            {categoryCounts[tab.key]}
                        </span>
                    </button>
                ))}
            </div>

            <div className="card">
                <div className="card-head">
                    <span>{t('service.instances')}</span>
                    <span className="hint mono" style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 'auto', fontWeight: 400 }}>{t('service.sort_top_first')}</span>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={serviceList} strategy={verticalListSortingStrategy}>
                        <div style={{ padding: 4 }}>
                            {serviceList.map((instanceKey) => {
                                const svcKey = getServiceKey(instanceKey)
                                const isEnabled = get_service_config(serviceInstances, instanceKey).enable !== false
                                return (
                                    <ServiceItemRow
                                        key={instanceKey}
                                        instanceKey={instanceKey}
                                        isEnabled={isEnabled}
                                        canDelete={serviceList.length > 1}
                                        canMoveUp={serviceList.indexOf(instanceKey) > 0}
                                        canMoveDown={serviceList.indexOf(instanceKey) < serviceList.length - 1}
                                        name={getInstanceName(instanceKey)}
                                        svcKey={svcKey}
                                        onToggle={toggleService}
                                        onEdit={openEdit}
                                        onRemove={removeService}
                                        onMoveUp={moveUp}
                                        onMoveDown={moveDown}
                                    />
                                )
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
                <div className="div" />
                <div style={{ padding: 10, display: 'flex', gap: 8 }}>
                    <button className="btn sm" data-testid="svc-add-btn" onClick={() => { setShowAddModal(true); }}>
                        <Icons.Plus size={12} />
                        {t('service.add', { defaultValue: '添加服务' })}
                    </button>
                </div>
            </div>

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
                    onClick={() => { setShowAddModal(false); }}
                >
                    <div
                        className="card"
                        style={{ width: 400, maxHeight: 400, overflow: 'auto', padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); }}
                    >
                        <div className="card-head">
                            <span>{t('service.add', { defaultValue: '添加服务' })}</span>
                            <button className="ic-btn" data-testid="svc-add-close" style={{ marginLeft: 'auto' }} onClick={() => { setShowAddModal(false); }}>
                                <Icons.Close size={13} />
                            </button>
                        </div>
                        <div style={{ padding: 4 }}>
                            {availableServices.map((svc) => (
                                <button
                                    key={svc.key}
                                    data-testid="svc-add-option"
                                    data-service-template={svc.key}
                                    onClick={() => { addService(svc.key); }}
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

            {editingKey && (
                <div
                    data-testid="svc-edit-modal"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                    }}
                    onClick={closeEdit}
                >
                    <div
                        className="card"
                        style={{ width: 480, padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); }}
                    >
                        <div className="card-head">
                            <span>{t('service.edit_service')}</span>
                            <button className="ic-btn" style={{ marginLeft: 'auto' }} onClick={closeEdit}>
                                <Icons.Close size={13} />
                            </button>
                        </div>
                        <div className="stack gap-12" style={{ padding: 12 }}>
                            <label className="stack gap-4" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                                {t('service.instance_name')}
                                <div className="field">
                                    <input data-testid="svc-edit-name" value={editName} onChange={(e) => { update_edit_name(e.target.value); }} />
                                </div>
                            </label>
                            <label className="stack gap-4" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                                {t('service.config_json')}
                                <textarea
                                    data-testid="svc-edit-config"
                                    className="mono"
                                    value={editConfigText}
                                    onChange={(e) => { update_edit_config_text(e.target.value); }}
                                    style={{
                                        minHeight: 140,
                                        resize: 'vertical',
                                        border: '1px solid var(--line)',
                                        borderRadius: 8,
                                        background: 'var(--bg-sunk)',
                                        color: 'var(--text)',
                                        padding: 10,
                                        fontSize: 12,
                                        fontFamily: 'var(--font-mono)',
                                    }}
                                />
                            </label>
                            <div style={{ minHeight: 18 }} data-testid="svc-test-status" className="hint">
                                {editStatus}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn sm" data-testid="svc-test" onClick={() => void testEdit()}>{t('service.test')}</button>
                                <button className="btn sm" onClick={closeEdit}>{t('ui.cancel')}</button>
                                <button className="btn primary sm" data-testid="svc-edit-save" onClick={saveEdit}>{t('ui.save')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
