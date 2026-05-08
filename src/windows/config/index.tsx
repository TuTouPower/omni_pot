import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { AiFillAppstore, AiFillCloud } from 'react-icons/ai'
import { PiTranslateFill, PiTextboxFill } from 'react-icons/pi'
import { MdKeyboardAlt, MdExtension } from 'react-icons/md'
import { FaHistory } from 'react-icons/fa'
import { BsInfoSquareFill } from 'react-icons/bs'
import GeneralPage from './general'
import TranslatePage from './translate_settings'
import RecognizePage from './recognize_settings'
import HotkeyPage from './hotkey_settings'
import ServicePage from './service_settings'
import HistoryPage from './history_settings'
import BackupPage from './backup_settings'
import AboutPage from './about'

type ConfigPage = 'general' | 'translate' | 'recognize' | 'hotkey' | 'service' | 'history' | 'backup' | 'about'

interface NavItem {
    key: ConfigPage
    labelKey: string
    icon: React.ReactNode
}

export default function ConfigWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [activePage, setActivePage] = useState<ConfigPage>('general')

    const pages: NavItem[] = [
        { key: 'general', labelKey: 'general.title', icon: <AiFillAppstore /> },
        { key: 'translate', labelKey: 'translate_settings.title', icon: <PiTranslateFill /> },
        { key: 'recognize', labelKey: 'recognize.title', icon: <PiTextboxFill /> },
        { key: 'hotkey', labelKey: 'hotkey.title', icon: <MdKeyboardAlt /> },
        { key: 'service', labelKey: 'service.title', icon: <MdExtension /> },
        { key: 'history', labelKey: 'history.title', icon: <FaHistory /> },
        { key: 'backup', labelKey: 'backup.title', icon: <AiFillCloud /> },
        { key: 'about', labelKey: 'about.title', icon: <BsInfoSquareFill /> }
    ]

    const renderPage = (): React.ReactElement => {
        switch (activePage) {
            case 'general': return <GeneralPage />
            case 'translate': return <TranslatePage />
            case 'recognize': return <RecognizePage />
            case 'hotkey': return <HotkeyPage />
            case 'service': return <ServicePage />
            case 'history': return <HistoryPage />
            case 'backup': return <BackupPage />
            case 'about': return <AboutPage />
        }
    }

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-[230px] border-r flex flex-col p-3 gap-1">
                <h2 className="text-lg font-bold mb-3 px-2">Pot</h2>
                {pages.map(({ key, labelKey, icon }) => (
                    <Button
                        key={key}
                        variant={activePage === key ? 'secondary' : 'ghost'}
                        onPress={() => setActivePage(key)}
                        className="justify-start gap-2"
                    >
                        {icon}
                        {t(labelKey)}
                    </Button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {renderPage()}
            </div>
        </div>
    )
}
