import React from 'react'
import { Button, Card } from '@heroui/react'

export default function AboutPage(): React.ReactElement {
    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">About</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="text-2xl font-bold">Omni Pot</h4>
                    <p className="text-sm text-default-500">Version 1.0.0</p>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Tech Stack</h4>
                    <p className="text-sm">Electron + React + TypeScript</p>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Links</h4>
                    <p className="text-sm text-default-500">
                        https://github.com/pot-app/pot-desktop
                    </p>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Updates</h4>
                    <Button isDisabled color="primary">
                        Check Update (Coming Soon)
                    </Button>
                </Card.Content>
            </Card>
        </div>
    )
}
