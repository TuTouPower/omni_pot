import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CAMBRIDGE_LANGUAGES: LanguageCode[] = ['auto', 'en', 'zh_cn', 'zh_tw']

function regex_capture(match: RegExpMatchArray | RegExpExecArray, index: number): string {
    return match[index] ?? ''
}

function extract_text(html: string, start_idx: number): string {
    let result = ''
    let i = start_idx
    while (i < html.length) {
        if (html[i] === '<') {
            const close_idx = html.indexOf('>', i)
            if (close_idx === -1) break
            i = close_idx + 1
            continue
        }
        result += html[i]
        i++
    }
    return result.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

export const cambridgeDictService: TranslateService = {
    key: 'cambridge_dict',
    name: 'Cambridge Dict',
    languages: CAMBRIDGE_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode
    ): Promise<string | DictResult> {
        void to
        if (from === 'auto') {
            from = /^[A-Za-z]/.test(text) ? 'en' : from
        }

        if (from !== 'en' && from !== 'zh_cn' && from !== 'zh_tw') {
            return ''
        }

        if (text.split(' ').length > 1 && from === 'en') {
            return ''
        }

        const dataset = 'english'

        const url = `https://dictionary.cambridge.org/search/direct/?datasetsearch=${dataset}&q=${encodeURIComponent(text)}`

        const resp = await fetch(url, {
            headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })

        if (!resp.ok) {
            throw new Error(`Cambridge Dict error: ${String(resp.status)}`)
        }

        const html = await resp.text()

        if (!html.includes('pr entry-body__el') && !html.includes('entry-body__el')) {
            throw new Error(`Word not found: ${text}`)
        }

        const pronunciations: DictResult['pronunciations'] = []
        const definitions: DictResult['definitions'] = []
        const examples: DictResult['examples'] = []

        const entry_pattern = /class="pr entry-body__el[\s"'][^>]*>([\s\S]*?)(?=class="pr entry-body__el|$)/g
        let entry_match: RegExpExecArray | null
        let first_entry = true
        while ((entry_match = entry_pattern.exec(html)) !== null) {
            const entry_html = regex_capture(entry_match, 1)

            if (first_entry) {
                first_entry = false
                const pron_pattern = /class="[^"]*dpron-i[^>]*>([\s\S]*?)<\/span>\s*<\/span>/g
                let pron_match: RegExpExecArray | null
                while ((pron_match = pron_pattern.exec(entry_html)) !== null) {
                    const block = regex_capture(pron_match, 1)
                    const region_match = block.match(/class="region[^"]*"[^>]*>([^<]*)</)
                    const symbol_match = block.match(/class="[^"]*\bipa\b[^"]*"[^>]*>([^<]*)/)
                        ?? block.match(/class="pron[^"]*"[^>]*>\/([^<]*)/)
                    if (region_match && symbol_match) {
                        const audio_src = block.match(/<source[^>]*type="audio\/mpeg"[^>]*src="([^"]*)"/)
                            ?? block.match(/data-src-mp3="([^"]*)"/)
                        const audio_url = audio_src
                            ? (regex_capture(audio_src, 1).startsWith('http')
                                ? regex_capture(audio_src, 1).trim()
                                : `https://dictionary.cambridge.org${regex_capture(audio_src, 1).trim()}`)
                            : undefined
                        pronunciations.push({
                            region: regex_capture(region_match, 1).trim(),
                            phonetic: regex_capture(symbol_match, 1).trim(),
                            audioUrl: audio_url
                        })
                        if (pronunciations.length >= 2) break
                    }
                }
            }

            const pos_match = entry_html.match(/class="[^"]*\bposgram\b[^"]*"[^>]*>([\s\S]*?)<\/span>/)
            const part_of_speech = pos_match
                ? extract_text(regex_capture(pos_match, 1), 0).replace(/\s+/g, ' ').trim()
                : ''

            const def_pattern = /class="def-block ddef_block\s*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
            let def_match: RegExpExecArray | null
            while ((def_match = def_pattern.exec(entry_html)) !== null) {
                const def_html = regex_capture(def_match, 1)

                if (def_html.includes('data-wl-senseid') && def_html.includes('panel')) {
                    continue
                }

                const eng_def_match = def_html.match(/class="def ddef_d db"[^>]*>([\s\S]*?)<\/span>/)
                const eng_def = eng_def_match
                    ? extract_text(regex_capture(eng_def_match, 1), 0).replace(/\s+/g, ' ').trim()
                    : ''

                const trans_match = def_html.match(/class="[^"]*\btrans\b[^"]*\bdtrans-se\b[^"]*"[^>]*>([\s\S]*?)<\/span>/)
                const trans_text = trans_match
                    ? extract_text(regex_capture(trans_match, 1), 0).replace(/\s+/g, ' ').trim()
                    : ''

                if (eng_def || trans_text) {
                    const meanings: string[] = []
                    if (eng_def) meanings.push(eng_def)
                    if (trans_text) {
                        meanings.push(...trans_text.split(';').map((s) => s.trim()).filter(Boolean))
                    }

                    definitions.push({
                        partOfSpeech: part_of_speech || eng_def,
                        meanings
                    })
                }

                const ex_pattern = /class="[^"]*\bexamp\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g
                let ex_match: RegExpExecArray | null
                while ((ex_match = ex_pattern.exec(def_html)) !== null) {
                    const eg_match = regex_capture(ex_match, 1).match(/class="[^"]*\beg\b[^"]*"[^>]*>([\s\S]*?)<\/span>/)
                    if (eg_match) {
                        const example_text = extract_text(regex_capture(eg_match, 1), 0).replace(/\s+/g, ' ').trim()
                        if (example_text) {
                            examples.push({ source: example_text, target: '' })
                        }
                    }
                }
            }
        }

        return {
            type: 'dict',
            pronunciations,
            definitions,
            examples
        }
    },

    async testConfig(): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', {})
            return typeof result === 'object' && result.definitions.length > 0
        } catch {
            return false
        }
    }
}
