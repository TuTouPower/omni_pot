import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { AiFillCloseCircle, AiOutlineCopy } from 'react-icons/ai'

export default function RecognizeWindow(): React.ReactElement {
    const [imageBase64, setImageBase64] = useState<string>('')
    const [recognizedText, setRecognizedText] = useState<string>('')

    // Signal to main process that renderer is ready to receive IPC
    useEffect(() => {
        window.electronAPI.ready('recognize')
    }, [])

    useEffect(() => {
        const unsub = window.electronAPI.ocr.onRecognizeShow((base64, text) => {
            setImageBase64(base64)
            setRecognizedText(text)
        })
        return unsub
    }, [])

    const handleCopy = useCallback(async () => {
        if (recognizedText) {
            await navigator.clipboard.writeText(recognizedText)
        }
    }, [recognizedText])

    const handleClose = useCallback(() => {
        window.electronAPI.window.close()
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
        <div className="flex flex-col h-screen select-none">
            <div className="flex justify-between items-center px-2 py-1">
                <span className="text-sm font-medium text-default-600">OCR Result</span>
                <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
                    <AiFillCloseCircle />
                </Button>
            </div>

            {imageBase64 && (
                <div className="px-2 pb-2">
                    <img
                        src={`data:image/png;base64,${imageBase64}`}
                        alt="captured"
                        className="max-h-32 w-auto rounded border border-default-200"
                    />
                </div>
            )}

            <div className="flex-1 px-2 pb-2 overflow-auto">
                <pre className="text-sm whitespace-pre-wrap break-words font-mono text-default-700">
                    {recognizedText || 'No text recognized'}
                </pre>
            </div>

            <div className="flex justify-end px-2 pb-2 gap-2">
                <Button
                    size="sm"
                    variant="flat"
                    startContent={<AiOutlineCopy />}
                    onPress={handleCopy}
                    isDisabled={!recognizedText}
                >
                    Copy
                </Button>
            </div>
        </div>
    )
}
