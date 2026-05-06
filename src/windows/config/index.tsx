import React, { useState } from 'react'
import { Button } from '@heroui/react'
import { AiFillAppstore } from 'react-icons/ai'
import { PiTranslateFill } from 'react-icons/pi'
import GeneralPage from './general'
import TranslatePage from './translate_settings'

type ConfigPage = 'general' | 'translate'

interface NavItem {
    key: ConfigPage
    label: string
    icon: React.ReactNode
}

export default function ConfigWindow(): React.ReactElement {
    const [activePage, setActivePage] = useState<ConfigPage>('general')

    const pages: NavItem[] = [
        { key: 'general', label: 'General', icon: <AiFillAppstore /> },
        { key: 'translate', label: 'Translate', icon: <PiTranslateFill /> }
    ]

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-[230px] border-r flex flex-col p-3 gap-1">
                <h2 className="text-lg font-bold mb-3 px-2">Pot</h2>
                {pages.map(({ key, label, icon }) => (
                    <Button
                        key={key}
                        variant={activePage === key ? 'secondary' : 'ghost'}
                        onPress={() => setActivePage(key)}
                        className="justify-start gap-2"
                    >
                        {icon}
                        {label}
                    </Button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activePage === 'general' && <GeneralPage />}
                {activePage === 'translate' && <TranslatePage />}
            </div>
        </div>
    )
}
