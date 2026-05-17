import { readFileSync, mkdirSync, copyFileSync, existsSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { execSync } from 'child_process'

// Step 0: Clone mapull/chinese-dictionary, run `git rev-parse HEAD`, paste here
const PINNED_COMMIT = 'e804ada333b68afddfdccbe8dcc938a72da157a7'
const DATA_DIR = process.env['CHINESE_DICT_DATA_DIR'] || join(__dirname, '..', 'github_repo', 'chinese-dictionary')
const OUTPUT_DIR = join(__dirname, '..', 'resources', 'data', 'dict')
const OUTPUT_DB = join(OUTPUT_DIR, 'chinese_dict.db')
const MAX_WORD_LEN = 100
const MAX_EXPLANATION_LEN = 10000
const WARN_SIZE_MB = 100
const FAIL_SIZE_MB = 150

function fail(msg: string): never {
    console.error(`[build:chinese-dict] FATAL: ${msg}`)
    process.exit(1)
}

function warn(msg: string): void {
    console.warn(`[build:chinese-dict] WARN: ${msg}`)
}

function load_json(filename: string): unknown[] {
    const path = join(DATA_DIR, filename)
    if (!existsSync(path)) fail(`Missing source file: ${path}`)
    const raw = readFileSync(path, 'utf-8')
    const trimmed = raw.trimStart()
    try {
        if (trimmed.startsWith('[')) {
            return JSON.parse(raw)
        }
        const body = raw.trimEnd().replace(/,\s*$/, '')
        return JSON.parse('[' + body + ']')
    } catch (e) {
        fail(`Failed to parse ${filename}: ${e}`)
    }
}

function get_source_commit(): string {
    try {
        return execSync('git rev-parse HEAD', { cwd: DATA_DIR, encoding: 'utf-8' }).trim()
    } catch {
        return 'unknown'
    }
}

function import_words(db: Database.Database): number {
    console.log('[build:chinese-dict] Loading word.json...')
    const words_raw = load_json('word/word.json') as Array<Record<string, unknown>>

    console.log(`[build:chinese-dict] Inserting ${words_raw.length} words...`)
    const insert_word = db.prepare('INSERT INTO words (word, pinyin, explanation) VALUES (?, ?, ?)')
    let word_count = 0
    const insert_words = db.transaction(() => {
        for (const w of words_raw) {
            const word = String(w['word'] ?? '').trim()
            const pinyin = String(w['pinyin'] ?? '').trim()
            const explanation = String(w['explanation'] ?? '').trim()
            if (!word || word.length > MAX_WORD_LEN) continue
            if (explanation.length > MAX_EXPLANATION_LEN) {
                warn(`Truncating explanation for word: ${word}`)
            }
            insert_word.run(word, pinyin, explanation.slice(0, MAX_EXPLANATION_LEN))
            word_count++
        }
    })
    insert_words()
    return word_count
}

function import_chars(db: Database.Database): number {
    console.log('[build:chinese-dict] Loading char_detail.json...')
    const chars_raw = load_json('character/char_detail.json') as Array<Record<string, unknown>>
    console.log(`[build:chinese-dict] Inserting ${chars_raw.length} characters...`)
    const insert_char = db.prepare('INSERT INTO characters (char, pinyin, explanation, speech, words) VALUES (?, ?, ?, ?, ?)')
    let char_count = 0
    const insert_chars = db.transaction(() => {
        for (const c of chars_raw) {
            const char = String(c['char'] ?? '').trim()
            if (!char) continue

            const pronunciations = c['pronunciations'] as Array<Record<string, unknown>> | undefined
            if (!pronunciations || !Array.isArray(pronunciations)) continue

            const pinyin_arr = pronunciations.map(p => String(p['pinyin'] ?? '')).filter(Boolean)

            const explanation_arr: Array<{ pinyin: string; speech: string; content: string }> = []
            const speech_set = new Set<string>()
            let first_words: string | null = null

            for (const p of pronunciations) {
                const py = String(p['pinyin'] ?? '')
                const explanations = p['explanations'] as Array<Record<string, unknown>> | undefined
                if (!explanations) continue
                for (const e of explanations) {
                    const content = String(e['content'] ?? '').trim()
                    const speech = String(e['speech'] ?? '').trim()
                    if (content) {
                        explanation_arr.push({ pinyin: py, speech, content })
                    }
                    if (speech) speech_set.add(speech)
                    if (!first_words && e['words'] && Array.isArray(e['words'])) {
                        const normalized = (e['words'] as Array<Record<string, unknown>>).map(w => ({
                            word: String(w['word'] ?? ''),
                            text: String(w['text'] ?? ''),
                        }))
                        first_words = JSON.stringify(normalized.slice(0, 5))
                    }
                }
            }

            if (explanation_arr.length === 0) continue
            insert_char.run(
                char,
                JSON.stringify(pinyin_arr),
                JSON.stringify(explanation_arr),
                speech_set.size > 0 ? JSON.stringify([...speech_set]) : null,
                first_words
            )
            char_count++
        }
    })
    insert_chars()
    return char_count
}

function import_idioms(db: Database.Database): number {
    console.log('[build:chinese-dict] Loading idiom.json...')
    const idioms_raw = load_json('idiom/idiom.json') as Array<Record<string, unknown>>
    console.log(`[build:chinese-dict] Inserting ${idioms_raw.length} idioms...`)
    const insert_idiom = db.prepare('INSERT INTO idioms (word, pinyin, explanation, source, example, similar, opposite) VALUES (?, ?, ?, ?, ?, ?, ?)')
    let idiom_count = 0
    const insert_idioms = db.transaction(() => {
        for (const i of idioms_raw) {
            const word = String(i['word'] ?? '').trim()
            const pinyin = String(i['pinyin'] ?? '').trim()
            const explanation = String(i['explanation'] ?? '').trim()
            if (!word || !explanation) continue

            const source = i['source'] ? JSON.stringify(i['source']) : null
            const example = i['example'] ? String(i['example']).trim() : null
            const similar = i['similar'] && Array.isArray(i['similar']) ? JSON.stringify(i['similar']) : null
            const opposite = i['opposite'] && Array.isArray(i['opposite']) ? JSON.stringify(i['opposite']) : null

            insert_idiom.run(word, pinyin, explanation, source, example, similar, opposite)
            idiom_count++
        }
    })
    insert_idioms()
    return idiom_count
}

function build(): void {
    // 1. Validate source directory
    if (!existsSync(DATA_DIR)) {
        fail(`Source directory not found: ${DATA_DIR}\nSet CHINESE_DICT_DATA_DIR or clone mapull/chinese-dictionary to github_repo/`)
    }

    // 2. Validate pinned commit
    const source_commit = get_source_commit()
    if (source_commit !== PINNED_COMMIT && source_commit !== 'unknown') {
        const is_ci = !!process.env['CI']
        if (is_ci) {
            fail(`Source commit mismatch: expected ${PINNED_COMMIT}, got ${source_commit}`)
        } else {
            warn(`Source commit mismatch: expected ${PINNED_COMMIT}, got ${source_commit}`)
        }
    }

    // 3. Validate LICENSE
    const license_src = join(DATA_DIR, 'LICENSE')
    if (!existsSync(license_src)) fail('Missing LICENSE file in source data')

    // 4. Prepare output
    mkdirSync(OUTPUT_DIR, { recursive: true })
    if (existsSync(OUTPUT_DB)) unlinkSync(OUTPUT_DB)

    const db = new Database(OUTPUT_DB)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')

    // 5. Create tables
    db.exec(`
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            pinyin TEXT NOT NULL,
            explanation TEXT NOT NULL
        );
        CREATE TABLE characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            char TEXT NOT NULL UNIQUE,
            pinyin TEXT NOT NULL,
            explanation TEXT NOT NULL,
            speech TEXT,
            words TEXT
        );
        CREATE TABLE idioms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            pinyin TEXT NOT NULL,
            explanation TEXT NOT NULL,
            source TEXT,
            example TEXT,
            similar TEXT,
            opposite TEXT
        );
        CREATE INDEX idx_words_word ON words(word);
        CREATE INDEX idx_characters_char ON characters(char);
        CREATE INDEX idx_idioms_word ON idioms(word);
    `)

    // 6. Import data (serial to limit memory peak)
    const word_count = import_words(db)
    const char_count = import_chars(db)
    const idiom_count = import_idioms(db)

    // 7. FTS
    console.log('[build:chinese-dict] Building FTS index...')
    db.exec(`
        CREATE VIRTUAL TABLE words_fts USING fts5(word, explanation, content=words, content_rowid=id, tokenize='unicode61');
        CREATE VIRTUAL TABLE characters_fts USING fts5(char, explanation, content=characters, content_rowid=id, tokenize='unicode61');
        INSERT INTO words_fts(words_fts) VALUES('rebuild');
        INSERT INTO characters_fts(characters_fts) VALUES('rebuild');
    `)

    // 8. Metadata
    const build_time = new Date().toISOString()
    const insert_meta = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)')
    insert_meta.run('schema_version', '1')
    insert_meta.run('data_version', 'mapull-2026-05')
    insert_meta.run('source', 'mapull/chinese-dictionary')
    insert_meta.run('source_commit', source_commit)
    insert_meta.run('build_time', build_time)

    db.close()

    // 9. Copy LICENSE (skip if already committed to repo)
    const license_dest = join(OUTPUT_DIR, 'chinese-dictionary-LICENSE')
    if (!existsSync(license_dest)) {
        copyFileSync(license_src, license_dest)
    }

    // 10. Check size
    const size_mb = statSync(OUTPUT_DB).size / (1024 * 1024)
    console.log(`[build:chinese-dict] Output: ${OUTPUT_DB} (${size_mb.toFixed(1)} MB)`)
    if (size_mb > FAIL_SIZE_MB) fail(`db size ${size_mb.toFixed(1)} MB exceeds limit of ${FAIL_SIZE_MB} MB`)
    if (size_mb > WARN_SIZE_MB) warn(`db size ${size_mb.toFixed(1)} MB exceeds warning threshold of ${WARN_SIZE_MB} MB`)

    console.log(`[build:chinese-dict] Done: ${word_count} words, ${char_count} chars, ${idiom_count} idioms`)
}

build()
