import React from 'react'
import { Button, Card } from '@heroui/react'
import { AiFillGithub } from 'react-icons/ai'
import { BiGlobe, BiFolder, BiLog } from 'react-icons/bi'

const VERSION = '0.1.0'

export default function AboutPage(): React.ReactElement {
    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">About</h3>

            <Card>
                <Card.Content className="gap-3 p-4 text-center">
                    <h4 className="text-3xl font-bold">Omni Pot</h4>
                    <p className="text-sm text-default-500">Version {VERSION}</p>
                    <p className="text-sm text-default-400">
                        A cross-platform translate & recognize tool
                    </p>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Tech Stack</h4>
                    <div className="text-sm text-default-500">
                        <p>Electron 35 + React 19 + TypeScript</p>
                        <p>HeroUI v3 + Tailwind CSS v4</p>
                        <p>better-sqlite3 + electron-vite</p>
                    </div>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Links</h4>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="flat"
                            startContent={<AiFillGithub />}
                            onPress={() => window.open('https://github.com/pot-app/pot-desktop', '_blank')}
                        >
                            GitHub
                        </Button>
                        <Button
                            size="sm"
                            variant="flat"
                            startContent={<BiGlobe />}
                            onPress={() => window.open('https://pot-app.com', '_blank')}
                        >
                            Website
                        </Button>
                    </div>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Data</h4>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="flat"
                            startContent={<BiFolder />}
                            onPress={() => window.electronAPI.config.get('server_port')}
                        >
                            Open Config Dir
                        </Button>
                    </div>
                </Card.Content>
            </Card>
        </div>
    )
}
