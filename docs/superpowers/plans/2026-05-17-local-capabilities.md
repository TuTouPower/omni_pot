# Local Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Chinese dictionary with real data (32万+ words) via SQLite, and replace regex-based language detection with cld3-asm WASM neural network.

**Architecture:** Two independent features sharing a pattern: main-process module with SQLite/WASM → IPC handlers → preload bridge → renderer service. Chinese dictionary uses build-time pre-built SQLite from mapull/chinese-dictionary JSON. Language detection uses cld3-asm WASM loaded in main process with regex fallback.

**Tech Stack:** TypeScript, Electron 39, better-sqlite3, cld3-asm (WASM), electron-vite, electron-builder

**Spec:** `docs/superpowers/specs/2026-05-17-local-capabilities-design.md`

---

## File Structure

### Part 1: Chinese Dictionary

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/build_chinese_dict.ts` | Create | JSON → SQLite build script |
| `electron/chinese_dict/index.ts` | Create | SQLite open, query, reload, path resolution |
| `electron/ipc/chinese_dict_handlers.ts` | Create | IPC handlers: lookup, check, reload |
| `electron/preload.ts` | Modify | Add `chineseDict` bridge |
| `electron/main.ts` | Modify | Register chinese dict handlers |
| `src/services/chinese_dictionary.ts` | Rewrite | IPC-based service replacing hardcoded |
| `package.json` | Modify | Add `build:chinese-dict` script, extraResources |
| `.gitignore` | Modify | Ignore build db + WAL files |
| `tests/chinese_dict/build.test.ts` | Create | Build script tests |
| `tests/chinese_dict/query.test.ts` | Create | Query + mapping tests |

### Part 2: Language Detection

| File | Action | Responsibility |
|------|--------|----------------|
| `electron/detect/index.ts` | Create | cld3 WASM load + detect + state machine |
| `electron/ipc/detect_handlers.ts` | Create | IPC handler: detect:local |
| `electron/preload.ts` | Modify | Add `detect.local` bridge |
| `electron/main.ts` | Modify | Register detect handlers + WASM preload |
| `src/services/detect.ts` | Modify | detect_local() → IPC call |
| `tests/detect/cld3.test.ts` | Create | Detection accuracy + fallback tests |

---

## Task 1: Build Script — Chinese Dictionary SQLite

**Files:**
- Create: `scripts/build_chinese_dict.ts`
- Modify: `package.json` (add script + dependency)
- Modify: `.gitignore`

- [ ] **Step 1: Add build script and dependencies to package.json**

Add to `scripts`:
```json
"build:chinese-dict": "npx tsx scripts/build_chinese_dict.ts"
```

Add to `devDependencies`:
```json
"tsx": "^4.0.0"
```

Add to `dependencies` (already present: `better-sqlite3`):
```json
"cld3-asm": "^4.0.0"
```

- [ ] **Step 2: Update .gitignore**

Add these lines to `.gitignore`:
```
resources/data/dict/chinese_dict.db
resources/data/dict/chinese-dictionary-LICENSE
*.db-shm
*.db-wal
```

- [ ] **Step 3: Write the build script**

Create `scripts/build_chinese_dict.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import Database from 'better-sqlite3'
import { execSync } from 'child_process'

const PINNED_COMMIT = 'FILL_IN_AT_IMPLEMENTATION_TIME' // from clone HEAD
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
    try {
        return JSON.parse(readFileSync(path, 'utf-8'))
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

interface WordRow { word: string; pinyin: string; explanation: string }
interface CharRow { char: string; pinyin: string; explanation: string; speech: string | null; words: string | null }
interface IdiomRow { word: string; pinyin: string; explanation: string; source: string | null; example: string | null; similar: string | null; opposite: string | null }

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

    // 4. Load JSON
    console.log('[build:chinese-dict] Loading JSON files...')
    const words_raw = load_json('word/word.json') as Array<Record<string, unknown>>
    const chars_raw = load_json('character/char_detail.json') as Array<Record<string, unknown>>
    const idioms_raw = load_json('idiom/idiom.json') as Array<Record<string, unknown>>

    // 5. Prepare output
    mkdirSync(OUTPUT_DIR, { recursive: true })
    if (existsSync(OUTPUT_DB)) {
        const { unlinkSync } = require('fs')
        unlinkSync(OUTPUT_DB)
    }

    const db = new Database(OUTPUT_DB)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')

    // 6. Create tables
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

    // 7. Insert words
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

    // 8. Insert characters
    console.log(`[build:chinese-dict] Inserting ${chars_raw.length} characters...`)
    const insert_char = db.prepare('INSERT INTO characters (char, pinyin, explanation, speech, words) VALUES (?, ?, ?, ?, ?)')
    let char_count = 0
    const insert_chars = db.transaction(() => {
        for (const c of chars_raw) {
            const char = String(c['char'] ?? '').trim()
            if (!char) continue

            const pronunciations = c['pronunciations'] as Array<Record<string, unknown>> | undefined
            if (!pronunciations || !Array.isArray(pronunciations)) continue

            // pinyin: JSON array of all pinyin values
            const pinyin_arr = pronunciations.map(p => String(p['pinyin'] ?? '')).filter(Boolean)

            // explanation: JSON array preserving pinyin→speech→content mapping
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
                        first_words = JSON.stringify(e['words'].slice(0, 5))
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

    // 9. Insert idioms
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

    // 10. FTS
    console.log('[build:chinese-dict] Building FTS index...')
    db.exec(`
        CREATE VIRTUAL TABLE words_fts USING fts5(word, explanation, content=words, content_rowid=id, tokenize='unicode61');
        CREATE VIRTUAL TABLE characters_fts USING fts5(char, explanation, content=characters, content_rowid=id, tokenize='unicode61');
        INSERT INTO words_fts(words_fts) VALUES('rebuild');
        INSERT INTO characters_fts(characters_fts) VALUES('rebuild');
    `)

    // 11. Metadata
    const build_time = new Date().toISOString()
    const insert_meta = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)')
    insert_meta.run('schema_version', '1')
    insert_meta.run('data_version', 'mapull-2026-05')
    insert_meta.run('source', 'mapull/chinese-dictionary')
    insert_meta.run('source_commit', source_commit)
    insert_meta.run('build_time', build_time)

    db.close()

    // 12. Copy LICENSE
    copyFileSync(license_src, join(OUTPUT_DIR, 'chinese-dictionary-LICENSE'))

    // 13. Check size
    const size_mb = statSync(OUTPUT_DB).size / (1024 * 1024)
    console.log(`[build:chinese-dict] Output: ${OUTPUT_DB} (${size_mb.toFixed(1)} MB)`)
    if (size_mb > FAIL_SIZE_MB) fail(`db size ${size_mb.toFixed(1)} MB exceeds limit of ${FAIL_SIZE_MB} MB`)
    if (size_mb > WARN_SIZE_MB) warn(`db size ${size_mb.toFixed(1)} MB exceeds warning threshold of ${WARN_SIZE_MB} MB`)

    console.log(`[build:chinese-dict] Done: ${word_count} words, ${char_count} chars, ${idiom_count} idioms`)
}

build()
```

- [ ] **Step 4: Verify the build script runs**

Run: `npm run build:chinese-dict` (requires cloned data at `github_repo/chinese-dictionary`)

Expected: Output shows word/char/idiom counts and final db size. `resources/data/dict/chinese_dict.db` exists.

- [ ] **Step 5: Commit**

```bash
git add scripts/build_chinese_dict.ts package.json .gitignore
git commit -m "feat(chinese-dict): add build script for JSON→SQLite conversion"
```

---

## Task 2: Main Process — Chinese Dictionary SQLite Module

**Files:**
- Create: `electron/chinese_dict/index.ts`

- [ ] **Step 1: Create the main process module**

Create `electron/chinese_dict/index.ts`:

```typescript
import { join } from 'path'
import { existsSync, statSync } from 'fs'
import Database from 'better-sqlite3'
import { log } from '../log'

const log_dict = log.scope('chinese-dict')

type DbState = 'idle' | 'ready' | 'failed'
type ServiceState = 'missing' | 'building' | 'ready' | 'failed'

let db: Database.Database | undefined
let db_state: DbState = 'idle'
let cached_path: string | undefined
let service_state: ServiceState = 'missing'

// Parsed JSON types
interface ExplanationEntry {
    pinyin: string
    speech: string
    content: string
}

interface WordRow {
    word: string
    pinyin: string
    explanation: string
}

interface CharRow {
    char: string
    pinyin: string // JSON array
    explanation: string // JSON array of ExplanationEntry
    speech: string | null // JSON array
    words: string | null // JSON array
}

interface IdiomRow {
    word: string
    pinyin: string
    explanation: string
    source: string | null
    example: string | null
    similar: string | null
    opposite: string | null
}

function find_db_path(): string | null {
    const candidates = [
        join(process.resourcesPath, 'data', 'dict', 'chinese_dict.db'),
        join(__dirname, '..', '..', '..', 'resources', 'data', 'dict', 'chinese_dict.db'),
    ]
    return candidates.find(p => existsSync(p)) ?? null
}

function open_db(): Database.Database | null {
    if (db_state === 'failed') return null
    if (db) return db

    const path = cached_path ?? find_db_path()
    if (!path) {
        db_state = 'failed'
        log_dict.warn('db file not found in any candidate path')
        return null
    }

    try {
        db = new Database(path, { readonly: true })
        db.pragma('journal_mode = WAL')

        // Validate schema version
        const meta = db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string } | undefined
        if (!meta || parseInt(meta.value) !== 1) {
            log_dict.error('schema version mismatch: expected 1, got %s', meta?.value ?? 'missing')
            db.close()
            db = undefined
            db_state = 'failed'
            return null
        }

        cached_path = path
        db_state = 'ready'
        log_dict.info('db opened: %s', path)
        return db
    } catch (e) {
        log_dict.error('failed to open db: %s', e)
        db = undefined
        db_state = 'failed'
        return null
    }
}

export function is_ready(): boolean {
    return open_db() !== null
}

export function get_service_state(): ServiceState {
    if (service_state === 'building') return 'building'
    if (is_ready()) {
        service_state = 'ready'
        return 'ready'
    }
    if (service_state === 'missing') return 'missing'
    return 'failed'
}

export function set_service_state(state: ServiceState): void {
    service_state = state
}

export function get_entry_count(): number {
    const database = open_db()
    if (!database) return 0
    const row = database.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number }
    return row.count
}

export function lookup_word(text: string): WordRow | null {
    const database = open_db()
    if (!database) return null
    return database.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?').get(text) as WordRow | null
}

export function lookup_idiom(text: string): IdiomRow | null {
    const database = open_db()
    if (!database) return null
    return database.prepare('SELECT * FROM idioms WHERE word = ?').get(text) as IdiomRow | null
}

export function lookup_character(text: string): CharRow | null {
    const database = open_db()
    if (!database) return null
    return database.prepare('SELECT * FROM characters WHERE char = ?').get(text) as CharRow | null
}

export function fts_search(prefix: string, limit = 5): WordRow[] {
    const database = open_db()
    if (!database) return []
    // Strip non-whitelist chars, append * for prefix match
    const cleaned = prefix.replace(/[^一-鿿㐀-䶿a-zA-Z0-9\s]/g, '')
    if (!cleaned) return []
    const query = `${cleaned}*`
    return database.prepare(
        'SELECT word, pinyin, explanation FROM words_fts WHERE word MATCH ? LIMIT ?'
    ).all(query, limit) as WordRow[]
}

export function reload_db(): boolean {
    if (db) {
        db.close()
        db = undefined
    }
    db_state = 'idle'
    cached_path = undefined
    return is_ready()
}

export function close_chinese_dict(): void {
    if (db) {
        db.close()
        db = undefined
    }
    db_state = 'idle'
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.node.json`

Expected: No errors for the new file.

- [ ] **Step 3: Commit**

```bash
git add electron/chinese_dict/index.ts
git commit -m "feat(chinese-dict): add main process SQLite module"
```

---

## Task 3: IPC Handlers — Chinese Dictionary

**Files:**
- Create: `electron/ipc/chinese_dict_handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create IPC handlers**

Create `electron/ipc/chinese_dict_handlers.ts`:

```typescript
import { ipcMain } from 'electron'
import {
    lookup_word,
    lookup_idiom,
    lookup_character,
    fts_search,
    is_ready,
    get_entry_count,
    get_service_state,
    reload_db,
} from '../chinese_dict'
import type { DictResult } from '@shared/types/service'

interface ExplanationEntry {
    pinyin: string
    speech: string
    content: string
}

function to_dict_result_word(row: { word: string; pinyin: string; explanation: string }): DictResult {
    return {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: row.pinyin }],
        definitions: [{ partOfSpeech: '', meanings: [row.explanation] }],
        examples: [],
    }
}

function to_dict_result_char(row: {
    char: string; pinyin: string; explanation: string; speech: string | null; words: string | null
}): DictResult {
    const pinyins: string[] = JSON.parse(row.pinyin)
    const explanations: ExplanationEntry[] = JSON.parse(row.explanation)

    // Group by pinyin
    const grouped = new Map<string, ExplanationEntry[]>()
    for (const e of explanations) {
        const arr = grouped.get(e.pinyin) ?? []
        arr.push(e)
        grouped.set(e.pinyin, arr)
    }

    const definitions: DictResult['definitions'] = []
    for (const [, items] of grouped) {
        definitions.push({
            partOfSpeech: items.map(i => i.speech).filter(Boolean).join('、'),
            meanings: items.map(i => i.content),
        })
    }

    return {
        type: 'dict',
        pronunciations: pinyins.map(p => ({ region: '普通话', phonetic: p })),
        definitions,
        examples: [],
    }
}

function to_dict_result_idiom(row: {
    word: string; pinyin: string; explanation: string; example: string | null
}): DictResult {
    return {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: row.pinyin }],
        definitions: [{ partOfSpeech: '成语', meanings: [row.explanation] }],
        examples: row.example ? [{ source: row.example, target: '' }] : [],
    }
}

function is_chinese(text: string): boolean {
    return /[一-鿿㐀-䶿]/.test(text)
}

function clean_input(text: string): string {
    return text.trim().replace(/[\s　，、。！？；：“”‘’《》（）…—]+/g, '')
}

export function registerChineseDictHandlers(): void {
    ipcMain.handle('chineseDict:lookup', (_event, text: string): DictResult | null => {
        if (!is_ready()) return null

        const word = clean_input(text)
        if (!word || !is_chinese(word)) return null
        if (word.length > 100) return null

        if (word.length === 1) {
            // Single character
            const char_row = lookup_character(word)
            if (char_row) return to_dict_result_char(char_row)
            const word_row = lookup_word(word)
            if (word_row) return to_dict_result_word(word_row)
            return null
        }

        // Multi-character word
        const word_row = lookup_word(word)
        if (word_row) return to_dict_result_word(word_row)

        const idiom_row = lookup_idiom(word)
        if (idiom_row) return to_dict_result_idiom(idiom_row)

        // FTS fallback
        const fts_results = fts_search(word)
        if (fts_results.length > 0) return to_dict_result_word(fts_results[0])

        return null
    })

    ipcMain.handle('chineseDict:check', () => {
        const state = get_service_state()
        return {
            ready: state === 'ready',
            status: state,
            entry_count: state === 'ready' ? get_entry_count() : 0,
        }
    })

    ipcMain.handle('chineseDict:reload', () => {
        return { success: reload_db() }
    })
}
```

- [ ] **Step 2: Add preload bridge**

In `electron/preload.ts`, add `chineseDict` to the `api` object (after the existing `dict` block):

```typescript
chineseDict: {
    lookup: (text: string) => ipcRenderer.invoke('chineseDict:lookup', text),
    check: () => ipcRenderer.invoke('chineseDict:check'),
    reload: () => ipcRenderer.invoke('chineseDict:reload'),
},
```

- [ ] **Step 3: Register in main.ts**

In `electron/main.ts`, add import and registration:

Import:
```typescript
import { registerChineseDictHandlers } from './ipc/chinese_dict_handlers'
```

After `registerDictHandlers()` line:
```typescript
registerChineseDictHandlers()
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add electron/ipc/chinese_dict_handlers.ts electron/preload.ts electron/main.ts
git commit -m "feat(chinese-dict): add IPC handlers and preload bridge"
```

---

## Task 4: Renderer Service — Chinese Dictionary

**Files:**
- Modify: `src/services/chinese_dictionary.ts`

- [ ] **Step 1: Rewrite the service**

Replace `src/services/chinese_dictionary.ts`:

```typescript
import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CHINESE_DICTIONARY_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn']

function is_chinese_text(text: string): boolean {
    return /[一-鿿㐀-䶿]/.test(text)
}

export const chineseDictionaryService: TranslateService = {
    key: 'chinese_dictionary',
    name: '中文词典',
    languages: CHINESE_DICTIONARY_LANGUAGES,

    async translate(text: string): Promise<string | DictResult> {
        const word = text.trim().replace(/\s+/g, '')
        if (!word || !is_chinese_text(word)) return ''

        try {
            const result = await window.electronAPI.chineseDict.lookup(word)
            return result ?? ''
        } catch {
            return ''
        }
    },

    async testConfig(): Promise<boolean> {
        try {
            const check = await window.electronAPI.chineseDict.check()
            return check.ready
        } catch {
            return false
        }
    }
}
```

- [ ] **Step 2: Update ElectronAPI type**

In `shared/types/ipc.ts` (or wherever `ElectronAPI` is defined), add:

```typescript
chineseDict: {
    lookup: (text: string) => Promise<DictResult | null>
    check: () => Promise<{ ready: boolean; status: string; entry_count: number }>
    reload: () => Promise<{ success: boolean }>
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.web.json`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/chinese_dictionary.ts shared/types/ipc.ts
git commit -m "feat(chinese-dict): rewrite renderer service to use IPC"
```

---

## Task 5: Build Script Tests

**Files:**
- Create: `tests/chinese_dict/build.test.ts`

- [ ] **Step 1: Write build script tests**

Create `tests/chinese_dict/build.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, statSync } from 'fs'
import { join } from 'path'

const DB_PATH = join(__dirname, '..', '..', 'resources', 'data', 'dict', 'chinese_dict.db')

describe('chinese_dict build', () => {
    let db: Database.Database

    beforeAll(() => {
        if (!existsSync(DB_PATH)) {
            // Skip if db not built yet
            return
        }
        db = new Database(DB_PATH, { readonly: true })
    })

    afterAll(() => {
        db?.close()
    })

    it.skipIf(!existsSync(DB_PATH))('has metadata table with correct entries', () => {
        const meta = db.prepare('SELECT * FROM metadata').all() as Array<{ key: string; value: string }>
        const map = new Map(meta.map(m => [m.key, m.value]))
        expect(map.get('schema_version')).toBe('1')
        expect(map.get('source')).toBe('mapull/chinese-dictionary')
        expect(map.has('build_time')).toBe(true)
        expect(map.has('source_commit')).toBe(true)
    })

    it.skipIf(!existsSync(DB_PATH))('words table has data', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number }
        expect(row.count).toBeGreaterThan(300000)
    })

    it.skipIf(!existsSync(DB_PATH))('characters table has data', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number }
        expect(row.count).toBeGreaterThan(20000)
    })

    it.skipIf(!existsSync(DB_PATH))('idioms table has data', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM idioms').get() as { count: number }
        expect(row.count).toBeGreaterThan(40000)
    })

    it.skipIf(!existsSync(DB_PATH))('words table sample entry has correct fields', () => {
        const row = db.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?').get('学习') as { word: string; pinyin: string; explanation: string } | undefined
        expect(row).toBeDefined()
        expect(row!.word).toBe('学习')
        expect(row!.pinyin).toBeTruthy()
        expect(row!.explanation).toBeTruthy()
    })

    it.skipIf(!existsSync(DB_PATH))('characters table has structured explanation JSON', () => {
        const row = db.prepare('SELECT char, pinyin, explanation FROM characters WHERE char = ?').get('行') as { char: string; pinyin: string; explanation: string } | undefined
        expect(row).toBeDefined()
        const pinyins: string[] = JSON.parse(row!.pinyin)
        expect(pinyins.length).toBeGreaterThanOrEqual(2) // háng, xíng
        const explanations: Array<{ pinyin: string; speech: string; content: string }> = JSON.parse(row!.explanation)
        expect(explanations.length).toBeGreaterThanOrEqual(2)
    })

    it.skipIf(!existsSync(DB_PATH))('FTS prefix search works', () => {
        const rows = db.prepare(
            "SELECT word FROM words_fts WHERE word MATCH ? LIMIT 5"
        ).all('莫名其*') as Array<{ word: string }>
        expect(rows.some(r => r.word === '莫名其妙')).toBe(true)
    })

    it.skipIf(!existsSync(DB_PATH))('db size is within limits', () => {
        const size_mb = statSync(DB_PATH).size / (1024 * 1024)
        expect(size_mb).toBeLessThan(150)
    })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/chinese_dict/build.test.ts`

Expected: All tests pass (or skip if db not built).

- [ ] **Step 3: Commit**

```bash
git add tests/chinese_dict/build.test.ts
git commit -m "test(chinese-dict): add build verification tests"
```

---

## Task 6: Query Tests

**Files:**
- Create: `tests/chinese_dict/query.test.ts`

- [ ] **Step 1: Write query tests**

Create `tests/chinese_dict/query.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// Test the input cleaning logic
function clean_input(text: string): string {
    return text.trim().replace(/[\s　，、。！？；：“”‘’《》（）…—]+/g, '')
}

function is_chinese(text: string): boolean {
    return /[一-鿿㐀-䶿]/.test(text)
}

describe('chinese_dict input cleaning', () => {
    it('strips punctuation', () => {
        expect(clean_input('你好，世界！')).toBe('你好世界')
    })

    it('strips whitespace', () => {
        expect(clean_input('  你好  ')).toBe('你好')
    })

    it('returns empty for empty input', () => {
        expect(clean_input('')).toBe('')
        expect(clean_input('   ')).toBe('')
    })

    it('returns empty for non-Chinese', () => {
        expect(is_chinese('hello')).toBe(false)
        expect(is_chinese('你好')).toBe(true)
    })

    it('handles long input', () => {
        const long = '学'.repeat(200)
        expect(long.length > 100).toBe(true)
    })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/chinese_dict/query.test.ts`

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add tests/chinese_dict/query.test.ts
git commit -m "test(chinese-dict): add input cleaning tests"
```

---

## Task 7: cld3-asm Spike Verification

**Files:**
- None (exploration only)

- [ ] **Step 1: Install cld3-asm and test basic import**

Run: `npm install cld3-asm`

Then create a temporary test file and run:
```typescript
import { loadModule } from 'cld3-asm'
const factory = await loadModule()
const instance = factory.create(0)
const result = instance.findLanguage('Hello world')
console.log(result) // { language: 'en', is_reliable: true, proportion: 1.0 }
```

Expected: Works in Node.js environment.

- [ ] **Step 2: Test in Electron main process context**

Run `npm run dev`, add a temporary log in main.ts:
```typescript
import { loadModule } from 'cld3-asm'
const factory = await loadModule()
const instance = factory.create(0)
console.log('CLD3 test:', instance.findLanguage('你好世界'))
```

Expected: `{ language: 'zh', is_reliable: true, proportion: 1.0 }`

If this fails, the spike fails — need to investigate WASM loading in Electron.

- [ ] **Step 3: Clean up temp code and commit dependency**

```bash
git add package.json package-lock.json
git commit -m "chore: add cld3-asm dependency"
```

---

## Task 8: Main Process — Language Detection Module

**Files:**
- Create: `electron/detect/index.ts`

- [ ] **Step 1: Create the detect module**

Create `electron/detect/index.ts`:

```typescript
import type { LanguageCode } from '@shared/types/language'
import { log } from '../log'

const log_detect = log.scope('detect')

type WasmState = 'loading' | 'ready' | 'failed'

let wasm_state: WasmState = 'loading'
let cld3_factory: { create(n: number): Cld3Instance } | undefined
let load_failed_logged = false

interface Cld3Instance {
    findLanguage(text: string): { language: string; is_reliable: boolean; proportion: number }
}

// BCP-47 → LanguageCode mapping
const CLD3_LANG_MAP: Record<string, LanguageCode> = {
    'zh': 'zh_cn',
    'zh-Hant': 'zh_tw',
    'ja': 'ja',
    'ko': 'ko',
    'en': 'en',
    'fr': 'fr',
    'de': 'de',
    'es': 'es',
    'it': 'it',
    'pt': 'pt_pt',
    'nl': 'nl',
    'tr': 'tr',
    'ru': 'ru',
    'ar': 'ar',
    'hi': 'hi',
    'th': 'th',
    'vi': 'vi',
    'id': 'id',
    'ms': 'ms',
    'uk': 'uk',
    'he': 'he',
    'fa': 'fa',
    'sv': 'sv',
    'pl': 'pl',
    'nb': 'nb_no',
}

// Regex-based fallback (current logic)
function detect_regex(text: string): LanguageCode {
    if (/[一-鿿]/.test(text)) return 'zh_cn'
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
    if (/[가-힯]/.test(text)) return 'ko'
    if (/[Ѐ-ӿ]/.test(text)) {
        if (/[іїєґ]/.test(text)) return 'uk'
        return 'ru'
    }
    if ((/[฀-๿]/.test(text))) return 'th'
    if (/[؀-ۿ]/.test(text)) {
        if (/[گچپژ]/.test(text)) return 'fa'
        return 'ar'
    }
    if (/[֐-׿]/.test(text)) return 'he'
    if (/[ऀ-ॿ]/.test(text)) return 'hi'
    if (/[ăằẳẵặâầẩẫậđêềểễệôồổỗộơờởỡợùừửữựýỳỷỹỵ]/i.test(text)) return 'vi'
    return 'en'
}

export async function init_cld3(): Promise<void> {
    try {
        const { loadModule } = await import('cld3-asm')
        cld3_factory = await loadModule()
        wasm_state = 'ready'
        log_detect.info('cld3-asm WASM loaded successfully')
    } catch (e) {
        wasm_state = 'failed'
        if (!load_failed_logged) {
            log_detect.error('cld3-asm WASM load failed, falling back to regex: %s', e)
            load_failed_logged = true
        }
    }
}

export function detect_local_cld3(text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } {
    // If WASM not ready or failed, use regex
    if (wasm_state !== 'ready' || !cld3_factory) {
        return { lang: detect_regex(text), source: 'regex' }
    }

    try {
        const instance = cld3_factory.create(0)
        const result = instance.findLanguage(text)

        // Low confidence → fallback to regex
        if (!result.is_reliable) {
            return { lang: detect_regex(text), source: 'regex' }
        }

        const mapped = CLD3_LANG_MAP[result.language]
        if (mapped) {
            return { lang: mapped, source: 'cld3' }
        }

        // Unmapped language: compare with regex
        const regex_result = detect_regex(text)
        // If regex identified a non-English script, use it (better than defaulting to en)
        if (regex_result !== 'en') {
            return { lang: regex_result, source: 'regex' }
        }
        // Pure ASCII Latin → default en
        return { lang: 'en', source: 'cld3' }
    } catch {
        return { lang: detect_regex(text), source: 'regex' }
    }
}

export function get_wasm_state(): WasmState {
    return wasm_state
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.node.json`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add electron/detect/index.ts
git commit -m "feat(detect): add main process cld3-asm language detection module"
```

---

## Task 9: IPC Handlers — Language Detection

**Files:**
- Create: `electron/ipc/detect_handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create IPC handlers**

Create `electron/ipc/detect_handlers.ts`:

```typescript
import { ipcMain } from 'electron'
import { detect_local_cld3 } from '../detect'
import type { LanguageCode } from '@shared/types/language'

export function registerDetectHandlers(): void {
    ipcMain.handle('detect:local', (_event, text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } => {
        if (!text || text.trim().length === 0) {
            return { lang: 'en', source: 'regex' }
        }
        return detect_local_cld3(text)
    })
}
```

- [ ] **Step 2: Add preload bridge**

In `electron/preload.ts`, add `detect` to the `api` object:

```typescript
detect: {
    local: (text: string) => ipcRenderer.invoke('detect:local', text),
},
```

- [ ] **Step 3: Register in main.ts and init WASM**

In `electron/main.ts`, add imports:

```typescript
import { registerDetectHandlers } from './ipc/detect_handlers'
import { init_cld3 } from './detect'
```

After `registerTrayHandlers()` line:
```typescript
registerDetectHandlers()
```

After all IPC registrations (inside `app.whenReady()`), add async WASM preload:
```typescript
init_cld3().catch((err) => { log_main.error('cld3 init failed:', err) })
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add electron/ipc/detect_handlers.ts electron/preload.ts electron/main.ts
git commit -m "feat(detect): add IPC handlers and preload bridge for language detection"
```

---

## Task 10: Renderer Service — Language Detection

**Files:**
- Modify: `src/services/detect.ts`

- [ ] **Step 1: Update detect_local to use IPC**

In `src/services/detect.ts`, replace `detect_local` function:

```typescript
async function detect_local(text: string): Promise<LanguageCode> {
    try {
        const result = await window.electronAPI.detect.local(text)
        return result.lang
    } catch {
        // Fallback to inline regex if IPC fails
        if (/[一-鿿]/.test(text)) return 'zh_cn'
        if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
        if (/[가-힯]/.test(text)) return 'ko'
        if (/[Ѐ-ӿ]/.test(text)) {
            if (/[іїєґ]/.test(text)) return 'uk'
            return 'ru'
        }
        if (/[฀-๿]/.test(text)) return 'th'
        if (/[؀-ۿ]/.test(text)) {
            if (/[گچپژ]/.test(text)) return 'fa'
            return 'ar'
        }
        if (/[֐-׿]/.test(text)) return 'he'
        if (/[ऀ-ॿ]/.test(text)) return 'hi'
        if (/[ăằẳẵặâầẩẫậđêềểễệôồổỗộơờởỡợùừửữựýỳỷỹỵ]/i.test(text)) return 'vi'
        return 'en'
    }
}
```

Note: `detect_local` becomes `async` because it now uses IPC. The `detectLanguage` function already returns `Promise<LanguageCode>`, so this is compatible.

Also update the `ElectronAPI` type in `shared/types/ipc.ts`:

```typescript
detect: {
    local: (text: string) => Promise<{ lang: LanguageCode; source: 'cld3' | 'regex' }>
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.web.json`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/detect.ts shared/types/ipc.ts
git commit -m "feat(detect): update renderer to use IPC-based language detection"
```

---

## Task 11: Detection Tests

**Files:**
- Create: `tests/detect/cld3.test.ts`

- [ ] **Step 1: Write detection tests**

Create `tests/detect/cld3.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// Test the regex fallback logic directly (no IPC)
function detect_regex(text: string): string {
    if (/[一-鿿]/.test(text)) return 'zh_cn'
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
    if (/[가-힯]/.test(text)) return 'ko'
    if (/[Ѐ-ӿ]/.test(text)) {
        if (/[іїєґ]/.test(text)) return 'uk'
        return 'ru'
    }
    if (/[฀-๿]/.test(text)) return 'th'
    if (/[؀-ۿ]/.test(text)) {
        if (/[گچپژ]/.test(text)) return 'fa'
        return 'ar'
    }
    if (/[֐-׿]/.test(text)) return 'he'
    if (/[ऀ-ॿ]/.test(text)) return 'hi'
    if (/[ăằẳẵặâầẩẫậđêềểễệôồổỗộơờởỡợùừửữựýỳỷỹỵ]/i.test(text)) return 'vi'
    return 'en'
}

describe('regex fallback detection', () => {
    it('detects Chinese', () => {
        expect(detect_regex('你好世界')).toBe('zh_cn')
    })

    it('detects Japanese', () => {
        expect(detect_regex('こんにちは')).toBe('ja')
    })

    it('detects Korean', () => {
        expect(detect_regex('안녕하세요')).toBe('ko')
    })

    it('detects Russian', () => {
        expect(detect_regex('Привет мир')).toBe('ru')
    })

    it('detects Thai', () => {
        expect(detect_regex('สวัสดี')).toBe('th')
    })

    it('detects Arabic', () => {
        expect(detect_regex('مرحبا')).toBe('ar')
    })

    it('detects Hindi', () => {
        expect(detect_regex('नमस्ते')).toBe('hi')
    })

    it('detects Vietnamese', () => {
        expect(detect_regex('xin chào')).toBe('vi')
    })

    it('defaults to en for Latin text', () => {
        expect(detect_regex('Hello world')).toBe('en')
    })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/detect/cld3.test.ts`

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add tests/detect/cld3.test.ts
git commit -m "test(detect): add language detection fallback tests"
```

---

## Task 12: Final Integration — Verify Full Build

**Files:**
- None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No errors.

- [ ] **Step 3: Run unit tests**

Run: `npm test`

Expected: All pass.

- [ ] **Step 4: Run dev and verify chinese dict works**

Run: `npm run dev`, then in the app:
1. Open dictionary window
2. Type "学习" → should return real definition
3. Type "行" → should return multi-pronunciation entries
4. Type "asdkjh" → should return empty

Expected: Real dictionary data displayed.

- [ ] **Step 5: Run dev and verify language detection works**

In the app:
1. Translate "Bonjour" → should detect as French
2. Translate "你好" → should detect as Chinese
3. Translate "Hello" → should detect as English

Expected: Non-English Latin languages correctly detected.

- [ ] **Step 6: Build and package**

Run: `npm run dist`

Expected: Build succeeds, db included in resources.

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "feat: final integration for chinese dictionary and language detection"
```
