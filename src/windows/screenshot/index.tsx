import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { map_cover_rect_to_image_rect } from './crop'

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

interface SelectionRect {
    x: number
    y: number
    width: number
    height: number
}

function crop_image(base64: string, rect: SelectionRect, container_size: { width: number; height: number }): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const image_rect = map_cover_rect_to_image_rect(rect, container_size, {
                width: img.naturalWidth,
                height: img.naturalHeight,
            })
            const canvas = document.createElement('canvas')
            canvas.width = image_rect.width
            canvas.height = image_rect.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Failed to get canvas context'))
                return
            }
            ctx.drawImage(img, image_rect.x, image_rect.y, image_rect.width, image_rect.height, 0, 0, image_rect.width, image_rect.height)
            const data_url = canvas.toDataURL('image/png')
            resolve(data_url.replace('data:image/png;base64,', ''))
        }
        img.onerror = () => { reject(new Error('Failed to load image')); }
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

    const reset_selection = useCallback(() => {
        setSelecting(false)
        setStart(null)
        setEnd(null)
    }, [])

    const close_window = useCallback(() => window.electronAPI.window.close().catch(() => undefined), [])

    const cancel_selection = useCallback(() => {
        reset_selection()
        close_window().catch(console.error)
    }, [reset_selection, close_window])

    const confirm_selection = useCallback(async () => {
        if (!start || !end) {
            setSelecting(false)
            return
        }

        const rect: SelectionRect = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y)
        }

        reset_selection()

        if (rect.width < 5 || rect.height < 5) {
            return
        }

        try {
            const container = containerRef.current
            if (!container) return
            const bounds = container.getBoundingClientRect()
            const cropped = await crop_image(background, rect, { width: bounds.width, height: bounds.height })

            const { ocrServiceRegistry } = await import('@/services/registry')
            const { useConfigStore } = await import('@/stores/config_store')

            const config = useConfigStore.getState().config
            const service_instances = config.service_instances
            const service_list = config.recognize_service_list.filter((instance_key) => get_service_config(service_instances, instance_key).enable !== false)
            const language = config.recognize_language as LanguageCode

            let full_text = ''
            for (const instance_key of service_list) {
                const { getServiceKey } = await import('@shared/types/service')
                const service_key = getServiceKey(instance_key)
                const service = ocrServiceRegistry.get(service_key)
                if (!service) continue
                const instance_config = get_service_config(service_instances, instance_key)
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
                await window.electronAPI.text.writeClipboard(full_text)
            }

            if (mode === 'translate') {
                await window.electronAPI.ocr.sendToTranslate(full_text)
            } else {
                await window.electronAPI.ocr.openRecognize(cropped, full_text)
            }
        } catch {
            // crop or recognize failed
        }

        await close_window()
    }, [start, end, reset_selection, background, mode, close_window])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 2) {
            cancel_selection()
            return
        }
        setSelecting(true)
        setStart({ x: e.clientX, y: e.clientY })
        setEnd(null)
    }, [cancel_selection])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!selecting) return
        setEnd({ x: e.clientX, y: e.clientY })
    }, [selecting])

    const handleMouseUp = useCallback(() => {
        if (!selecting) return
        confirm_selection().catch(console.error)
    }, [selecting, confirm_selection])

    useEffect(() => {
        const handle_key_down = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                cancel_selection()
                return
            }
            if (event.key === 'Enter' && selecting) {
                event.preventDefault()
                confirm_selection().catch(console.error)
            }
        }
        window.addEventListener('keydown', handle_key_down)
        return () => { window.removeEventListener('keydown', handle_key_down); }
    }, [cancel_selection, confirm_selection, selecting])

    const selection_rect = start && end ? {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
    } : null

    return (
        <div
            ref={containerRef}
            data-testid="shot-root"
            style={{
                position: 'fixed',
                inset: 0,
                cursor: 'crosshair',
                backgroundImage: background ? `url(data:image/png;base64,${background})` : 'none',
                backgroundSize: 'cover',
                borderRadius: 12,
                overflow: 'hidden',
            }}
            onMouseDown={background ? handleMouseDown : undefined}
            onMouseMove={background ? handleMouseMove : undefined}
            onMouseUp={background ? handleMouseUp : undefined}
            onContextMenu={(e) => { e.preventDefault(); }}
        >
            {background && <div data-testid="shot-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(10, 10, 15, 0.55)' }} />}

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
                    {([[0, 0], [1, 0], [0, 1], [1, 1]] as Array<[number, number]>).map(([x, y], i) => (
                        <div
                            key={i}
                            data-testid="shot-corner-handle"
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

            {background && (
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
            )}
        </div>
    )
}
