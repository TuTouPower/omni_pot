import React, { useCallback, useEffect, useRef, useState } from 'react'

interface SelectionRect {
    x: number
    y: number
    width: number
    height: number
}

function crop_image(base64: string, rect: SelectionRect): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = rect.width
            canvas.height = rect.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Failed to get canvas context'))
                return
            }
            ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
            const data_url = canvas.toDataURL('image/png')
            resolve(data_url.replace('data:image/png;base64,', ''))
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = `data:image/png;base64,${base64}`
    })
}

export default function ScreenshotWindow(): React.ReactElement {
    const [background, setBackground] = useState<string>('')
    const [mode, setMode] = useState<string>('recognize')
    const [selecting, setSelecting] = useState(false)
    const [start, setStart] = useState<{ x: number; y: number } | null>(null)
    const [end, setEnd] = useState<{ x: number; y: number } | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const unsub = window.electronAPI.ocr.onScreenshotShow((base64, m) => {
            setBackground(base64)
            setMode(m)
        })
        window.electronAPI.ready('screenshot')
        return unsub
    }, [])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 2) {
            window.electronAPI.window.close()
            return
        }
        setSelecting(true)
        setStart({ x: e.clientX, y: e.clientY })
        setEnd(null)
    }, [])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!selecting) return
        setEnd({ x: e.clientX, y: e.clientY })
    }, [selecting])

    const handleMouseUp = useCallback(async () => {
        if (!selecting || !start || !end) {
            setSelecting(false)
            return
        }

        const rect: SelectionRect = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y)
        }

        setSelecting(false)
        setStart(null)
        setEnd(null)

        if (rect.width < 5 || rect.height < 5) {
            return
        }

        try {
            const cropped = await crop_image(background, rect)

            const { ocrServiceRegistry } = await import('@/services/registry')
            const { useConfigStore } = await import('@/stores/config_store')

            const config = useConfigStore.getState().config
            const service_list = config.recognize_service_list
            const service_instances = config.service_instances
            const language = config.recognize_language as import('@shared/types/language').LanguageCode

            let full_text = ''
            for (const instance_key of service_list) {
                const { getServiceKey } = await import('@shared/types/service')
                const service_key = getServiceKey(instance_key)
                const service = ocrServiceRegistry.get(service_key)
                if (!service) continue
                const instance_config = service_instances[instance_key]?.config ?? {}
                try {
                    const result = await service.recognize(cropped, language, instance_config)
                    if (result) {
                        full_text = result
                        break
                    }
                } catch {
                    continue
                }
            }

            if (full_text && config.recognize_auto_copy) {
                await navigator.clipboard.writeText(full_text)
            }

            if (mode === 'translate') {
                await window.electronAPI.ocr.sendToTranslate(full_text)
            } else {
                await window.electronAPI.ocr.openRecognize(cropped, full_text)
            }
        } catch {
            // crop or recognize failed
        }

        window.electronAPI.window.close()
    }, [selecting, start, end, background, mode])

    const selection_rect = start && end ? {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
    } : null

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                inset: 0,
                cursor: 'crosshair',
                backgroundImage: background ? `url(data:image/png;base64,${background})` : 'none',
                backgroundSize: 'cover',
                borderRadius: 12,
                overflow: 'hidden',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Dark translucent overlay */}
            <div data-testid="shot-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(10, 10, 15, 0.55)' }} />

            {/* Selection area */}
            {selection_rect && selection_rect.width > 0 && selection_rect.height > 0 && (
                <div
                    data-testid="shot-selection"
                    style={{
                        position: 'absolute',
                        left: selection_rect.x,
                        top: selection_rect.y,
                        width: selection_rect.width,
                        height: selection_rect.height,
                        border: '1.5px solid var(--brand-primary)',
                        boxShadow: '0 0 0 9999px rgba(10, 10, 15, 0.45)',
                    }}
                >
                    {/* Corner handles */}
                    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                left: x * selection_rect.width - 3,
                                top: y * selection_rect.height - 3,
                                width: 6,
                                height: 6,
                                background: 'var(--brand-primary)',
                                borderRadius: 1,
                            }}
                        />
                    ))}
                    {/* Size label */}
                    <div
                        data-testid="shot-size-label"
                        style={{
                            position: 'absolute',
                            right: 4,
                            bottom: -22,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: '#fff',
                            background: 'var(--brand-primary)',
                            padding: '2px 6px',
                            borderRadius: 4,
                        }}
                    >
                        {Math.round(selection_rect.width)} × {Math.round(selection_rect.height)}
                    </div>
                </div>
            )}

            {/* Top hint bar */}
            <div
                data-testid="shot-hint"
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: 14,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 6,
                    padding: '6px 10px',
                    background: 'rgba(20, 18, 16, 0.85)',
                    color: '#f5f3f0',
                    borderRadius: 999,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    pointerEvents: 'none',
                }}
            >
                <span>拖动选取区域</span>
                <span style={{ color: 'oklch(70% 0.01 70)' }}>·</span>
                <span>
                    <kbd style={{ background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }}>↵</kbd> 确认
                </span>
                <span style={{ color: 'oklch(70% 0.01 70)' }}>·</span>
                <span>
                    <kbd style={{ background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }}>Esc</kbd> 取消
                </span>
            </div>
        </div>
    )
}
