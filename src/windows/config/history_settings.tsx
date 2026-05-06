import React from 'react'
import { Button, Card, Label, Switch } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'

export default function HistorySettings(): React.ReactElement {
    const [historyDisable, setHistoryDisable] = useConfig('history_disable')

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">History</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <Switch isSelected={historyDisable} onChange={setHistoryDisable}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">Disable history</Label>
                        </Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <p className="text-sm text-default-500">
                        Translation history will be available in a future update.
                    </p>
                    <Button isDisabled color="danger">
                        Clear History
                    </Button>
                </Card.Content>
            </Card>
        </div>
    )
}
