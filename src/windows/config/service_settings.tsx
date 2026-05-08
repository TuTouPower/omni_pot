import React, { useState } from 'react'
import { Button, Card, Label, Modal, Switch } from '@heroui/react'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry, ocrServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { collectionServiceRegistry } from '../../services/index'
import { createServiceInstanceKey, getServiceKey } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'

type ServiceCategory = 'translate_service_list' | 'dictionary_service_list' | 'recognize_service_list' | 'tts_service_list' | 'collection_service_list'

const CATEGORY_TABS = [
    { key: 'translate_service_list' as ServiceCategory, label: 'Translate' },
    { key: 'dictionary_service_list' as ServiceCategory, label: 'Dictionary' },
    { key: 'recognize_service_list' as ServiceCategory, label: 'Recognize' },
    { key: 'tts_service_list' as ServiceCategory, label: 'TTS' },
    { key: 'collection_service_list' as ServiceCategory, label: 'Collection' }
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
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">Service</h3>

            <div className="flex gap-2 border-b pb-2">
                {CATEGORY_TABS.map((tab) => (
                    <Button
                        key={tab.key}
                        size="sm"
                        variant={activeTab === tab.key ? 'secondary' : 'ghost'}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            <Card>
                <Card.Content className="gap-2 p-4">
                    {serviceList.map((instanceKey, index) => (
                        <div key={instanceKey} className="flex items-center gap-2 p-2 rounded-md bg-default-50">
                            <span className="flex-1 text-sm">{getInstanceName(instanceKey)}</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                isDisabled={index === 0}
                                onPress={() => moveUp(index)}
                            >
                                Up
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                isDisabled={index === serviceList.length - 1}
                                onPress={() => moveDown(index)}
                            >
                                Down
                            </Button>
                            <Button
                                size="sm"
                                color="danger"
                                variant="ghost"
                                isDisabled={serviceList.length <= 1}
                                onPress={() => removeService(instanceKey)}
                            >
                                Delete
                            </Button>
                        </div>
                    ))}
                </Card.Content>
            </Card>

            <Button color="primary" onPress={() => setShowAddModal(true)}>
                Add Service
            </Button>

            {showAddModal && (
                <Modal
                    open={showAddModal}
                    onOpenChange={setShowAddModal}
                >
                    <Modal.Backdrop />
                    <Modal.Container>
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>Add Service</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                {availableServices.map((svc) => (
                                    <Button
                                        key={svc.key}
                                        variant="ghost"
                                        className="justify-start"
                                        onPress={() => addService(svc.key)}
                                    >
                                        {svc.name}
                                    </Button>
                                ))}
                            </Modal.Body>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal>
            )}
        </div>
    )
}
