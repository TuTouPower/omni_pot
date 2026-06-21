import React from 'react'
import { SvcTile } from '../../components/svc_tile'
import { Dropdown } from '../../components/dropdown'

export { SvcTile }

// OCR engine metadata (subset of SVC_META for action bar)
export const OCR_META: Partial<Record<string, { name: string; mono: string; tone: string }>> = {
    system: { name: '系统文字识别', mono: 'SY', tone: 'oklch(54% 0.005 70)' },
    tesseract: { name: 'Tesseract', mono: 'TE', tone: 'oklch(58% 0.10 50)' },
    openai_compatible: { name: 'AI 视觉', mono: 'VL', tone: 'oklch(58% 0.02 180)' },
    baidu_accurate_ocr: { name: '百度高精度', mono: 'BA', tone: 'oklch(58% 0.16 250)' },
    baidu_ocr: { name: '百度文字识别', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
    tencent_ocr: { name: '腾讯文字识别', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
    iflytek_ocr: { name: '讯飞文字识别', mono: 'IF', tone: 'oklch(60% 0.13 220)' },
    iflytek_latex_ocr: { name: '讯飞 LaTeX', mono: 'TX', tone: 'oklch(60% 0.13 220)' },
    qrcode: { name: '二维码', mono: 'QR', tone: 'oklch(50% 0.01 70)' },
}

export function PillSelect({
    value,
    options,
    leading,
    onChange,
    testId,
}: {
    value: string
    options: { value: string; label: string; mono?: string }[]
    leading?: React.ReactNode
    onChange?: (v: string) => void
    testId?: string
}): React.ReactElement {
    return (
        <Dropdown
            value={value}
            options={options}
            onChange={(v) => { onChange?.(v) }}
            testId={testId ?? 'pill-select'}
            optionTestIdPrefix={testId ? `${testId}-option` : 'pill-select-option'}
            leading={leading}
            chevronSize={11}
            triggerStyle={{
                height: 30,
                padding: '0 10px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                color: 'var(--text)',
                fontSize: 12.5,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
            }}
            renderOption={({ option }) => (
                <>
                    {option.mono && <SvcTile name={option.mono} size={18} />}
                    <span>{option.label}</span>
                </>
            )}
        />
    )
}
