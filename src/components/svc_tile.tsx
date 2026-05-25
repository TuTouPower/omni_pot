import React from 'react'

export const SVC_META: Partial<Record<string, { name: string; mono: string; tone: string }>> = {
    deepl: { name: 'DeepL', mono: 'DL', tone: 'oklch(70% 0.10 240)' },
    bing: { name: 'Bing', mono: 'BG', tone: 'oklch(65% 0.10 200)' },
    google: { name: 'Google', mono: 'GG', tone: 'oklch(68% 0.10 130)' },
    yandex: { name: 'Yandex', mono: 'YD', tone: 'oklch(65% 0.13 25)' },
    chinese_dictionary: { name: '中文词典', mono: 'ZD', tone: 'oklch(60% 0.13 25)' },
    openai: { name: 'OpenAI', mono: 'AI', tone: 'oklch(58% 0.02 180)' },
    geminipro: { name: 'Gemini', mono: 'GM', tone: 'oklch(64% 0.12 280)' },
    chatglm: { name: 'ChatGLM', mono: 'GL', tone: 'oklch(60% 0.12 30)' },
    ollama: { name: 'Ollama', mono: 'OL', tone: 'oklch(55% 0.005 70)' },
    baidu: { name: '百度', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
    baidu_field: { name: '百度领域', mono: 'BF', tone: 'oklch(58% 0.16 250)' },
    bing_dict: { name: 'Bing 词典', mono: 'BD', tone: 'oklch(65% 0.10 200)' },
    caiyun: { name: '彩云小译', mono: 'CY', tone: 'oklch(70% 0.12 220)' },
    cambridge_dict: { name: 'Cambridge', mono: 'CD', tone: 'oklch(58% 0.13 25)' },
    alibaba: { name: '阿里巴巴', mono: 'AB', tone: 'oklch(60% 0.15 30)' },
    tencent: { name: '腾讯', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
    transmart: { name: 'TranSmart', mono: 'TS', tone: 'oklch(60% 0.13 230)' },
    volcengine: { name: '火山引擎', mono: 'VE', tone: 'oklch(60% 0.13 25)' },
    niutrans: { name: '牛翻译', mono: 'NT', tone: 'oklch(64% 0.12 145)' },
    youdao: { name: '有道', mono: 'YD', tone: 'oklch(58% 0.13 25)' },
    mymemory: { name: 'MyMemory', mono: 'MM', tone: 'oklch(60% 0.10 60)' },
    free_dictionary: { name: 'FreeDict', mono: 'FD', tone: 'oklch(60% 0.10 145)' },
    system: { name: '系统 OCR', mono: 'SY', tone: 'oklch(54% 0.005 70)' },
    tesseract: { name: 'Tesseract', mono: 'TE', tone: 'oklch(58% 0.10 50)' },
    baidu_ocr: { name: '百度 OCR', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
    baidu_accurate_ocr: { name: '百度高精度', mono: 'BA', tone: 'oklch(58% 0.16 250)' },
    tencent_ocr: { name: '腾讯 OCR', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
    iflytek_ocr: { name: '讯飞 OCR', mono: 'IF', tone: 'oklch(60% 0.13 220)' },
    iflytek_latex_ocr: { name: '讯飞 LaTeX', mono: 'TX', tone: 'oklch(60% 0.13 220)' },
    openai_compatible: { name: 'AI 视觉', mono: 'VL', tone: 'oklch(58% 0.02 180)' },
    qrcode: { name: '二维码', mono: 'QR', tone: 'oklch(50% 0.01 70)' },
    system_tts: { name: 'System TTS', mono: 'SY', tone: 'oklch(60% 0.08 250)' },
    anki: { name: 'Anki', mono: 'AK', tone: 'oklch(58% 0.13 25)' },
    eudic: { name: '欧路词典', mono: 'EU', tone: 'oklch(60% 0.13 145)' },
    ecdict: { name: 'CC-CEDICT', mono: 'EC', tone: 'oklch(55% 0.13 145)' },
}

export function SvcTile({ name, size = 24 }: { name: string; size?: number }): React.ReactElement {
    const m = SVC_META[name] ?? { mono: name.slice(0, 2).toUpperCase(), tone: 'oklch(55% 0.005 70)' }
    return (
        <div
            className={'svc-tile' + (size >= 32 ? ' lg' : '')}
            style={{
                color: m.tone,
                borderColor: 'color-mix(in oklab, ' + m.tone + ' 30%, var(--line))',
            }}
        >
            {m.mono}
        </div>
    )
}

export function svcLabel(name: string): string {
    return SVC_META[name]?.name ?? name
}
