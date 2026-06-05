import { useEffect, useLayoutEffect, useRef } from 'react'
import type { DictResult } from '@shared/types/service'

export function use_translate_height_reporting(
    showSource: boolean,
    hideLanguage: boolean,
    enabledServiceListLength: number,
    isTranslating: boolean,
    appFont: string,
    appFontSize: number,
    results: Record<string, string | DictResult | null>,
    sourceLanguage: string,
    targetLanguage: string,
    detectedLanguage: string | null,
    effectiveTargetLanguage: string | null
): {
    titlebar_ref: React.RefObject<HTMLDivElement | null>
    top_ref: React.RefObject<HTMLDivElement | null>
    language_ref: React.RefObject<HTMLDivElement | null>
    results_scroll_ref: React.RefObject<HTMLDivElement | null>
    results_content_ref: React.RefObject<HTMLDivElement | null>
} {
    const titlebar_ref = useRef<HTMLDivElement>(null)
    const top_ref = useRef<HTMLDivElement>(null)
    const language_ref = useRef<HTMLDivElement>(null)
    const results_scroll_ref = useRef<HTMLDivElement>(null)
    const results_content_ref = useRef<HTMLDivElement>(null)
    const last_reported_content_height_ref = useRef(0)
    const last_reported_min_width_ref = useRef(0)

    useLayoutEffect(() => {
        const titlebar = titlebar_ref.current
        const top = top_ref.current
        const results_scroll = results_scroll_ref.current
        const results_content = results_content_ref.current

        let frame_id = 0
        const report = (): void => {
            window.cancelAnimationFrame(frame_id)
            frame_id = window.requestAnimationFrame(() => {
                const titlebar_h = titlebar ? titlebar.getBoundingClientRect().height : 0
                const top_h = top ? top.getBoundingClientRect().height : 0
                const results_h = results_content ? results_content.scrollHeight : 0
                const results_style = results_scroll ? getComputedStyle(results_scroll) : null
                const results_padding_h = results_style
                    ? Number.parseFloat(results_style.paddingTop) + Number.parseFloat(results_style.paddingBottom)
                    : 0
                const total = Math.ceil(titlebar_h + top_h + results_h + results_padding_h)
                if (total === last_reported_content_height_ref.current) return
                last_reported_content_height_ref.current = total
                window.electronAPI.translate.reportContentHeight(total).catch(() => undefined)
            })
        }

        report()
        const observer = new ResizeObserver(report)
        if (titlebar) observer.observe(titlebar)
        if (top) observer.observe(top)
        if (results_content) observer.observe(results_content)
        return () => {
            window.cancelAnimationFrame(frame_id)
            observer.disconnect()
        }
    }, [showSource, hideLanguage, enabledServiceListLength, isTranslating, appFont, appFontSize, results])

    useEffect(() => {
        const language = language_ref.current
        if (!language) {
            if (last_reported_min_width_ref.current !== 0) {
                last_reported_min_width_ref.current = 0
                window.electronAPI.translate.reportMinWidth(0).catch(() => undefined)
            }
            return
        }

        let frame_id = 0
        const report = (): void => {
            window.cancelAnimationFrame(frame_id)
            frame_id = window.requestAnimationFrame(() => {
                const source = language.querySelector('[data-testid="lang-source-button"]')
                const swap = language.querySelector('[data-testid="lang-swap"]')
                const target = language.querySelector('[data-testid="lang-target-button"]')
                if (!source || !swap || !target) return

                const rects = [source, swap, target].map((el) => (el as HTMLElement).getBoundingClientRect())
                const style = getComputedStyle(language)
                const padding_w = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
                const left = Math.min(...rects.map((rect) => rect.left))
                const right = Math.max(...rects.map((rect) => rect.right))
                const width = Math.ceil(right - left + padding_w)
                if (width === last_reported_min_width_ref.current) return
                last_reported_min_width_ref.current = width
                window.electronAPI.translate.reportMinWidth(width).catch(() => undefined)
            })
        }

        report()
        const observer = new ResizeObserver(report)
        observer.observe(language)
        for (const el of language.querySelectorAll('[data-testid="lang-source-button"], [data-testid="lang-swap"], [data-testid="lang-target-button"]')) {
            observer.observe(el)
        }
        return () => {
            window.cancelAnimationFrame(frame_id)
            observer.disconnect()
        }
    }, [hideLanguage, sourceLanguage, targetLanguage, detectedLanguage, effectiveTargetLanguage, appFont, appFontSize])

    return { titlebar_ref, top_ref, language_ref, results_scroll_ref, results_content_ref }
}
