import React from 'react'
import { useTranslation } from 'react-i18next'
import { native_language_name } from '../../i18n/language_names'
import type { LanguageCode } from '@shared/types/language'

export function RecognizeContent({
    isTranslateMode,
    recognizedText,
    translatedText,
    isRecognizing,
    isTranslating,
    detectedSourceLang,
    effectiveTargetLang,
    effectiveTarget,
    onTextChange,
}: {
    isTranslateMode: boolean
    recognizedText: string
    translatedText: string
    isRecognizing: boolean
    isTranslating: boolean
    detectedSourceLang: LanguageCode | null
    effectiveTargetLang: LanguageCode | null
    effectiveTarget: string
    onTextChange: (text: string) => void
}): React.ReactElement {
    const { t } = useTranslation()

    if (isTranslateMode) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8 }}>
                {/* Recognized text card */}
                <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 14px 0', fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {detectedSourceLang ? `${t('recognize.title')} ${native_language_name(t, detectedSourceLang)}` : t('recognize.title')}
                    </div>
                    <textarea
                        data-testid="ocr-text"
                        value={recognizedText}
                        onChange={(e) => { onTextChange(e.target.value); }}
                        placeholder={isRecognizing ? t('recognize.recognizing') : t('recognize.result_placeholder')}
                        style={{
                            flex: 1,
                            padding: '8px 14px 12px',
                            fontSize: 13.5,
                            lineHeight: 1.65,
                            color: 'var(--text)',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    />
                </div>
                {/* Translation result card */}
                <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 14px 0', fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {detectedSourceLang ? `${t('translate')} ${native_language_name(t, (effectiveTargetLang ?? effectiveTarget) as LanguageCode)}` : t('translate')}
                    </div>
                    <div
                        data-testid="ocr-translation"
                        style={{
                            flex: 1,
                            padding: '8px 14px 12px',
                            fontSize: 13.5,
                            lineHeight: 1.65,
                            color: 'var(--text)',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {isTranslating && !translatedText ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                                <div className="shimmer" style={{ height: 13, width: '70%' }} />
                                <div className="shimmer" style={{ height: 13, width: '90%' }} />
                                <div className="shimmer" style={{ height: 13, width: '50%' }} />
                            </div>
                        ) : translatedText || null}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <textarea
                data-testid="ocr-text"
                value={recognizedText}
                onChange={(e) => { onTextChange(e.target.value); }}
                placeholder={isRecognizing ? t('recognize.recognizing') : t('recognize.result_placeholder')}
                style={{
                    flex: 1,
                    padding: '12px 14px',
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                }}
            />
        </div>
    )
}
