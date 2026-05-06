import type { TranslateService, ServiceConfig, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CAMBRIDGE_LANGUAGES: LanguageCode[] = ['auto', 'en', 'zh_cn', 'zh_tw']

const CAMBRIDGE_LANG_MAP: Record<string, string> = {
    auto: 'english',
    en: 'english',
    zh_cn: 'chinese-simplified',
    zh_tw: 'chinese-traditional'
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

function find_block(html: string, marker: string, start_from: number): { content: string; end: number } | null {
    const idx = html.indexOf(marker, start_from)
    if (idx === -1) return null
    const tag_start = html.lastIndexOf('<', idx)
    if (tag_start === -1) return null

    const tag_match = html.substring(tag_start, idx).match(/^<(\w+)/)
    if (!tag_match) return null

    const tag_name = tag_match[1]
    let depth = 1
    let pos = tag_start + html.substring(tag_start).indexOf('>') + 1

    while (depth > 0 && pos < html.length) {
        const next_open = html.indexOf(`<${tag_name}`, pos)
        const next_close = html.indexOf(`</${tag_name}`, pos)

        if (next_close === -1) break

        if (next_open !== -1 && next_open < next_close) {
            depth++
            pos = next_open + tag_name.length + 1
        } else {
            depth--
            if (depth === 0) {
                const close_tag_end = html.indexOf('>', next_close) + 1
                return {
                    content: html.substring(tag_start, close_tag_end),
                    end: close_tag_end
                }
            }
            pos = next_close + tag_name.length + 2
        }
    }
    return null
}

export const cambridgeDictService: TranslateService = {
    key: 'cambridge_dict',
    name: 'Cambridge Dict',
    languages: CAMBRIDGE_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        _config: ServiceConfig
    ): Promise<string | DictResult> {
        if (from === 'auto') {
            from = /^[A-Za-z]/.test(text) ? 'en' : from
        }

        if (from !== 'en' && from !== 'zh_cn' && from !== 'zh_tw') {
            return ''
        }

        if (text.split(' ').length > 1 && from === 'en') {
            return ''
        }

        const dataset = from === 'en' && to !== 'en' && to !== 'auto'
            ? `${CAMBRIDGE_LANG_MAP[from] ?? 'english'}-${CAMBRIDGE_LANG_MAP[to] ?? 'chinese-simplified'}`
            : 'english'

        const url = `https://dictionary.cambridge.org/search/direct/?datasetsearch=${dataset}&q=${encodeURIComponent(text)}`

        const resp = await fetch(url, {
            headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })

        if (!resp.ok) {
            throw new Error(`Cambridge Dict error: ${resp.status}`)
        }

        const html = await resp.text()

        if (!html.includes('pr entry-body__el') && !html.includes('entry-body__el')) {
            throw new Error(`Word not found: ${text}`)
        }

        const pronunciations: DictResult['pronunciations'] = []
        const definitions: DictResult['definitions'] = []
        const examples: DictResult['examples'] = []

        const pron_pattern = /class="dpron-i"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
        let pron_match: RegExpExecArray | null
        while ((pron_match = pron_pattern.exec(html)) !== null) {
            const block = pron_match[1]
            const region_match = block.match(/class="region"[^>]*>([^<]*)</)
            const symbol_match = block.match(/class="pron"[^>]*>([^<]*)</)
            if (region_match && symbol_match) {
                pronunciations.push({
                    region: region_match[1].trim(),
                    phonetic: symbol_match[1].trim()
                })
            }
        }

        const entry_pattern = /class="pr entry-body__el[\s"'][^>]*>([\s\S]*?)(?=class="pr entry-body__el|$)/g
        let entry_match: RegExpExecArray | null
        while ((entry_match = entry_pattern.exec(html)) !== null) {
            const entry_html = entry_match[1]

            const pos_match = entry_html.match(/class="posgram"[^>]*>([\s\S]*?)<\/span>/)
            const part_of_speech = pos_match
                ? extract_text(pos_match[1], 0).replace(/\s+/g, ' ').trim()
                : ''

            const def_pattern = /class="def-block ddef_block"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
            let def_match: RegExpExecArray | null
            while ((def_match = def_pattern.exec(entry_html)) !== null) {
                const def_html = def_match[1]

                if (def_html.includes('data-wl-senseid') && def_html.includes('panel')) {
                    continue
                }

                const eng_def_match = def_html.match(/class="def ddef_d db"[^>]*>([\s\S]*?)<\/span>/)
                const eng_def = eng_def_match
                    ? extract_text(eng_def_match[1], 0).replace(/\s+/g, ' ').trim()
                    : ''

                const trans_match = def_html.match(/class="trans dtrans dtrans-se"[^>]*>([\s\S]*?)<\/span>/)
                const trans_text = trans_match
                    ? extract_text(trans_match[1], 0).replace(/\s+/g, ' ').trim()
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

                const ex_pattern = /class="examp"[^>]*>([\s\S]*?)<\/div>/g
                let ex_match: RegExpExecArray | null
                while ((ex_match = ex_pattern.exec(def_html)) !== null) {
                    const eg_match = ex_match[1].match(/class="eg"[^>]*>([\s\S]*?)<\/span>/)
                    if (eg_match) {
                        const example_text = extract_text(eg_match[1], 0).replace(/\s+/g, ' ').trim()
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

    async testConfig(_config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', {})
            return typeof result === 'object' && result.definitions.length > 0
        } catch {
            return false
        }
    }
}
