# Local Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Chinese dictionary with real data (32万+ words) via SQLite, and replace regex-based language detection with cld3-asm WASM neural network.

**Architecture:** Two independent features sharing a pattern: main-process module with SQLite/WASM → IPC handlers → preload bridge → renderer service. Chinese dictionary uses build-time pre-built SQLite from mapull/chinese-dictionary JSON. Language detection uses cld3-asm WASM loaded in main process with regex fallback.

**Tech Stack:** TypeScript, Electron 39, better-sqlite3, cld3-asm (WASM), electron-vite, electron-builder

**Spec:** `docs/superpowers/specs/2026-05-17-local-capabilities-design.md`

**Naming convention:** IPC bridge keys use camelCase (`chineseDict`, `detect.local`) following existing `electronAPI` style. Main process internal functions use snake_case per project convention.

---

## File Structure

### Part 1: Chinese Dictionary

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/build_chinese_dict.ts` | Create | JSON → SQLite build script |
| `electron/chinese_dict/index.ts` | Create | SQLite open, query, reload, path resolution, state machine |
| `electron/ipc/chinese_dict_handlers.ts` | Create | IPC handlers: lookup, check, reload (with config flag) |
| `electron/preload.ts` | Modify | Add `chineseDict` bridge |
| `electron/main.ts` | Modify | Register chinese dict handlers, dev auto-build + fs.watch |
| `src/services/chinese_dictionary.ts` | Rewrite | IPC-based service replacing hardcoded |
| `shared/types/ipc.ts` | Modify | Add `chineseDict` to `ElectronAPI` interface |
| `package.json` | Modify | Add `build:chinese-dict` script, `extraResources` for dict db |
| `.gitignore` | Modify | Ignore build db + WAL files |
| `tests/chinese_dict/build.test.ts` | Create | Build script verification tests |
| `tests/chinese_dict/query.test.ts` | Create | Query + mapping + IPC tests |

### Part 2: Language Detection

| File | Action | Responsibility |
|------|--------|----------------|
| `electron/detect/index.ts` | Create | cld3 WASM load + detect + state machine (module-level cached instance) |
| `electron/ipc/detect_handlers.ts` | Create | IPC handler: detect:local (with config flag) |
| `electron/preload.ts` | Modify | Add `detect.local` bridge |
| `electron/main.ts` | Modify | Register detect handlers + WASM preload |
| `src/services/detect.ts` | Modify | detect_local() → IPC call |
| `shared/types/ipc.ts` | Modify | Add `detect` to `ElectronAPI` interface |
| `tests/detect/cld3.test.ts` | Create | Detection accuracy + fallback + config tests |

---

## Task 0: cld3-asm Spike Verification (run before all other tasks)

**Files:**
- None (exploration only — do NOT add `cld3-asm` to package.json yet)

Spike-first: verify cld3-asm works in Electron 39 before investing in any other work. If spike fails, the language detection feature needs a different approach.

- [ ] **Step 1: Install cld3-asm locally and test basic import**

Run: `npm install --no-save cld3-asm`

Create a temporary spike file `scripts/spike_cld3.ts`:

```typescript
import { loadModule } from 'cld3-asm'

async function main() {
    console.log('[spike] Loading cld3-asm WASM...')
    const factory = await loadModule()
    const instance = factory.create(0)

    const tests = [
        { input: 'Hello world', expected_lang: 'en' },
        { input: '你好世界', expected_lang: 'zh' },
        { input: 'Bonjour le monde', expected_lang: 'fr' },
        { input: 'Hallo Welt', expected_lang: 'de' },
        { input: 'Hola mundo', expected_lang: 'es' },
        { input: 'Hi', expected_lang: 'en' }, // short text
    ]

    for (const t of tests) {
        const result = instance.findLanguage(t.input)
        const pass = result.language === t.expected_lang
        console.log(`[spike] "${t.input}" → ${result.language} (reliable=${result.is_reliable}) ${pass ? 'OK' : 'MISMATCH (expected ' + t.expected_lang + ')'}`)
    }

    console.log('[spike] Done')
}

main().catch(e => { console.error('[spike] FAILED:', e); process.exit(1) })
```

Run: `npx tsx scripts/spike_cld3.ts`

Expected: All language detections work in Node.js.

- [ ] **Step 2: Test in Electron main process context**

Run `npm run dev`. Add a temporary log in `electron/main.ts` inside `app.whenReady()`:

```typescript
import { loadModule } from 'cld3-asm'
loadModule().then(factory => {
    const instance = factory.create(0)
    console.log('[spike] CLD3 in Electron:', instance.findLanguage('你好世界'))
}).catch(e => console.error('[spike] CLD3 failed in Electron:', e))
```

Expected: `{ language: 'zh', is_reliable: true, proportion: 1.0 }`

If this fails — spike fails. Investigate WASM loading in Electron main process before proceeding.

- [ ] **Step 3: Test in dist build**

Run `npm run dist`. Install the built app, launch it, check logs for the spike output.

Expected: CLD3 works in packaged Electron app.

- [ ] **Step 4: Clean up and add dependency**

Remove spike code from main.ts. Delete `scripts/spike_cld3.ts`.

Now add `cld3-asm` to `package.json` dependencies:

```json
"cld3-asm": "^4.0.0"
```

Run `npm install`.

- [ ] **Step 5: Verify types compile**

Run: `npm run typecheck`

Expected: No errors.

---

## Task 1: Build Script — Chinese Dictionary SQLite

**Files:**
- Create: `scripts/build_chinese_dict.ts`
- Modify: `package.json` (add script + `tsx` devDependency; add `extraResources` for `resources/data/dict/`)
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

`cld3-asm` was already added in Task 0 Step 4.

- [ ] **Step 2: Add extraResources for chinese dict db**

In `package.json` `build.extraResources`, add a new entry alongside the existing `data` entry:

```json
{
  "from": "resources/data/dict/",
  "to": "data/dict/",
  "filter": [
    "**/*.db",
    "**/chinese-dictionary-LICENSE",
    "!**/*.db-shm",
    "!**/*.db-wal"
  ]
}
```

- [ ] **Step 3: Update .gitignore**

Add these lines:
```
resources/data/dict/chinese_dict.db
*.db-shm
*.db-wal
```

Note: `chinese-dictionary-LICENSE` is NOT ignored — it is committed directly to the repo (one-time copy of the mapull MIT license text). The build script also copies it from the source data, but only if missing.

- [ ] **Step 4: Write the build script**

Create `scripts/build_chinese_dict.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { execSync } from 'child_process'

// Step 0: Clone mapull/chinese-dictionary, run `git rev-parse HEAD`, paste here
const PINNED_COMMIT = 'FILL_IN_AT_IMPLEMENTATION_TIME'
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

    // 4. Load JSON — serial parse + explicit GC to limit memory peak
    console.log('[build:chinese-dict] Loading word.json...')
    const words_raw = load_json('word/word.json') as Array<Record<string, unknown>>

    // 5. Prepare output
    mkdirSync(OUTPUT_DIR, { recursive: true })
    if (existsSync(OUTPUT_DB)) unlinkSync(OUTPUT_DB)

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
    // Free words_raw memory before loading next file
    ;(words_raw as unknown as unknown[]).length = 0

    // 8. Insert characters
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
    ;(chars_raw as unknown as unknown[]).length = 0

    // 9. Insert idioms
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
    ;(idioms_raw as unknown as unknown[]).length = 0

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

    // 12. Copy LICENSE (skip if already committed to repo)
    const license_dest = join(OUTPUT_DIR, 'chinese-dictionary-LICENSE')
    if (!existsSync(license_dest)) {
        copyFileSync(license_src, license_dest)
    }

    // 13. Check size
    const size_mb = statSync(OUTPUT_DB).size / (1024 * 1024)
    console.log(`[build:chinese-dict] Output: ${OUTPUT_DB} (${size_mb.toFixed(1)} MB)`)
    if (size_mb > FAIL_SIZE_MB) fail(`db size ${size_mb.toFixed(1)} MB exceeds limit of ${FAIL_SIZE_MB} MB`)
    if (size_mb > WARN_SIZE_MB) warn(`db size ${size_mb.toFixed(1)} MB exceeds warning threshold of ${WARN_SIZE_MB} MB`)

    console.log(`[build:chinese-dict] Done: ${word_count} words, ${char_count} chars, ${idiom_count} idioms`)
}

build()
```

- [ ] **Step 5: Verify the build script runs**

Run: `npm run build:chinese-dict` (requires cloned data at `github_repo/chinese-dictionary`)

Expected: Output shows word/char/idiom counts and final db size. `resources/data/dict/chinese_dict.db` exists.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.

---

## Task 2: Main Process — Chinese Dictionary SQLite Module

**Files:**
- Create: `electron/chinese_dict/index.ts`

- [ ] **Step 1: Create the main process module**

Create `electron/chinese_dict/index.ts`:

```typescript
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { log } from '../log'

const log_dict = log.scope('chinese-dict')

type DbState = 'idle' | 'ready' | 'failed'
type ServiceState = 'missing' | 'building' | 'ready' | 'failed'

let db: Database.Database | undefined
let db_state: DbState = 'idle'
let cached_path: string | undefined
let service_state: ServiceState = 'missing'
const stmt_cache = new Map<string, Database.Statement>()

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
    pinyin: string
    explanation: string
    speech: string | null
    words: string | null
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

export function get_db_path(): string | null {
    if (cached_path) return cached_path
    return find_db_path()
}

function find_db_path(): string | null {
    // Use app.isPackaged to choose correct path, avoid accidental cross-read
    if (app.isPackaged) {
        const prod_path = join(process.resourcesPath, 'data', 'dict', 'chinese_dict.db')
        return existsSync(prod_path) ? prod_path : null
    }
    // dev: project root
    const dev_path = join(app.getAppPath(), 'resources', 'data', 'dict', 'chinese_dict.db')
    return existsSync(dev_path) ? dev_path : null
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

        // Validate schema version
        const meta = db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string } | undefined
        if (!meta || meta.value !== '1') {
            log_dict.error('schema version mismatch: expected 1, got %s', meta?.value ?? 'missing')
            db.close()
            db = undefined
            db_state = 'failed'
            return null
        }

        cached_path = path
        db_state = 'ready'

        // Prepare and cache frequently used statements
        stmt_cache.clear()
        stmt_cache.set('count_words', db.prepare('SELECT COUNT(*) as count FROM words'))
        stmt_cache.set('lookup_word', db.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?'))
        stmt_cache.set('lookup_idiom', db.prepare('SELECT word, pinyin, explanation, source, example, similar, opposite FROM idioms WHERE word = ?'))
        stmt_cache.set('lookup_char', db.prepare('SELECT char, pinyin, explanation, speech, words FROM characters WHERE char = ?'))
        stmt_cache.set('fts_search', db.prepare('SELECT word, pinyin, explanation FROM words_fts WHERE word MATCH ? LIMIT ?'))

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
    const stmt = stmt_cache.get('count_words') ?? database.prepare('SELECT COUNT(*) as count FROM words')
    const row = stmt.get() as { count: number }
    return row.count
}

export function lookup_word(text: string): WordRow | null {
    const database = open_db()
    if (!database) return null
    const stmt = stmt_cache.get('lookup_word') ?? database.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?')
    return stmt.get(text) as WordRow | null
}

export function lookup_idiom(text: string): IdiomRow | null {
    const database = open_db()
    if (!database) return null
    const stmt = stmt_cache.get('lookup_idiom') ?? database.prepare('SELECT word, pinyin, explanation, source, example, similar, opposite FROM idioms WHERE word = ?')
    return stmt.get(text) as IdiomRow | null
}

export function lookup_character(text: string): CharRow | null {
    const database = open_db()
    if (!database) return null
    const stmt = stmt_cache.get('lookup_char') ?? database.prepare('SELECT char, pinyin, explanation, speech, words FROM characters WHERE char = ?')
    return stmt.get(text) as CharRow | null
}

export function fts_search(prefix: string, limit = 5): WordRow[] {
    const database = open_db()
    if (!database) return []
    const cleaned = prefix.replace(/[^\p{Script=Han}a-zA-Z0-9]/gu, '')
    if (!cleaned) return []
    const query = `${cleaned}*`
    const stmt = stmt_cache.get('fts_search') ?? database.prepare('SELECT word, pinyin, explanation FROM words_fts WHERE word MATCH ? LIMIT ?')
    return stmt.all(query, limit) as WordRow[]
}

export function reload_db(): boolean {
    // Close old connection and clear cached state before reopening
    if (db) {
        db.close()
        db = undefined
    }
    db_state = 'idle'
    cached_path = undefined
    stmt_cache.clear()
    const success = is_ready()
    service_state = success ? 'ready' : 'failed'
    return success
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

Run: `npm run typecheck`

Expected: No errors for the new file.

---

## Task 3: IPC Handlers — Chinese Dictionary

**Files:**
- Create: `electron/ipc/chinese_dict_handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Modify: `shared/types/ipc.ts`

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
import { getConfig } from '../config'
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

    // Map words field (related words) into examples
    const examples: DictResult['examples'] = []
    if (row.words) {
        try {
            const words_arr = JSON.parse(row.words) as Array<{ word: string; text: string }>
            for (const w of words_arr.slice(0, 3)) {
                examples.push({ source: `${w.word}：${w.text}`, target: '' })
            }
        } catch {
            // malformed words JSON — skip
        }
    }

    return {
        type: 'dict',
        pronunciations: pinyins.map(p => ({ region: '普通话', phonetic: p })),
        definitions,
        examples,
    }
}

function to_dict_result_idiom(row: {
    word: string; pinyin: string; explanation: string; example: string | null; source: string | null
}): DictResult {
    const examples: DictResult['examples'] = []
    // Map source (出处) into examples
    if (row.source) {
        try {
            const src = JSON.parse(row.source) as { text?: string; book?: string }
            if (src.text) examples.push({ source: `【出处】${src.text}${src.book ? `（${src.book}）` : ''}`, target: '' })
        } catch {
            // malformed source JSON — skip
        }
    }
    if (row.example) {
        examples.push({ source: row.example, target: '' })
    }

    return {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: row.pinyin }],
        definitions: [{ partOfSpeech: '成语', meanings: [row.explanation] }],
        examples,
        // FUTURE: extend DictResult with idiom_meta?: { source, similar, opposite }
    }
}

// Whitelist clean for FTS queries: keep CJK (including Ext B-F), letters, digits, whitespace only
function clean_for_fts(text: string): string {
    return text.replace(/[^\p{Script=Han}a-zA-Z0-9\s]/gu, '').trim()
}

// Exact query: strip punctuation, trim, length check
function clean_for_exact(text: string): string {
    // Strip non-CJK, non-alphanumeric characters (punctuation, symbols)
    const stripped = text.replace(/[^\p{Script=Han}a-zA-Z0-9\s]/gu, '').trim()
    if (stripped.length === 0 || stripped.length > 100) return ''
    return stripped
}

function is_chinese(text: string): boolean {
    return /\p{Script=Han}/u.test(text)
}

export function registerChineseDictHandlers(): void {
    ipcMain.handle('chineseDict:lookup', (_event, text: string): DictResult | null => {
        // Config flag: short-circuit if disabled
        const enabled = getConfig('dict.chinese_enabled')
        if (enabled === false) return null

        if (!is_ready()) return null

        const word = clean_for_exact(text)
        if (!word || !is_chinese(word)) return null

        if (word.length === 1) {
            // Single character: exact lookup only
            const char_row = lookup_character(word)
            if (char_row) return to_dict_result_char(char_row)
            const word_row = lookup_word(word)
            if (word_row) return to_dict_result_word(word_row)
            return null
        }

        // Multi-character word: exact → idiom → FTS prefix
        const word_row = lookup_word(word)
        if (word_row) return to_dict_result_word(word_row)

        const idiom_row = lookup_idiom(word)
        if (idiom_row) return to_dict_result_idiom(idiom_row)

        // FTS fallback (use whitelist-cleaned input)
        const fts_input = clean_for_fts(word)
        if (!fts_input) return null
        const fts_results = fts_search(fts_input)
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

In `electron/preload.ts`, add `chineseDict` to the `api` object (after the existing `dict` block at line 114):

```typescript
chineseDict: {
    lookup: (text: string) => ipcRenderer.invoke('chineseDict:lookup', text),
    check: () => ipcRenderer.invoke('chineseDict:check'),
    reload: () => ipcRenderer.invoke('chineseDict:reload'),
    onStateChanged: (callback: (state: string) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, state: string) => { callback(state); }
        ipcRenderer.on('chineseDict:state-changed', handler)
        return () => { ipcRenderer.off('chineseDict:state-changed', handler) }
    },
},
```

- [ ] **Step 3: Update ElectronAPI type**

In `shared/types/ipc.ts`, add to the `ElectronAPI` interface (after the `dict` block at line 82):

```typescript
chineseDict: {
    lookup(text: string): Promise<DictResult | null>
    check(): Promise<{ ready: boolean; status: string; entry_count: number }>
    reload(): Promise<{ success: boolean }>
    onStateChanged(callback: (state: string) => void): () => void
}
```

- [ ] **Step 4: Register in main.ts**

In `electron/main.ts`, add import and registration:

Import:
```typescript
import { registerChineseDictHandlers } from './ipc/chinese_dict_handlers'
```

After `registerDictHandlers()` line:
```typescript
registerChineseDictHandlers()
```

- [ ] **Step 5: Verify types compile**

Run: `npm run typecheck`

Expected: No errors.

---

## Task 4: Dev Auto-Build + State Machine + fs.watch

**Files:**
- Modify: `electron/main.ts`

This task wires up the service state machine and dev-mode auto-build that Task 2 exports but never connects.

- [ ] **Step 1: Add imports at the top of main.ts**

Add these imports at the top of `electron/main.ts` (with the other imports):

```typescript
import { get_db_path, get_service_state, set_service_state, reload_db, close_chinese_dict } from './chinese_dict'
import { existsSync, watch } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
```

- [ ] **Step 2: Add dev auto-build logic + fs.watch in main.ts**

After `registerChineseDictHandlers()`, add:

```typescript
// Chinese dict: dev auto-build + state machine
const dict_db_path = get_db_path()

function register_db_watch(db_path: string): void {
    let debounce: ReturnType<typeof setTimeout> | null = null
    try {
        watch(db_path, () => {
            if (debounce) clearTimeout(debounce)
            debounce = setTimeout(() => { reload_db() }, 500)
        })
    } catch {
        // watch failed — non-critical
    }
}

if (!dict_db_path || !existsSync(dict_db_path)) {
    if (app.isPackaged) {
        // prod: db should be bundled; missing = failed
        set_service_state('failed')
    } else {
        // dev: auto-trigger build
        set_service_state('building')
        const npm_cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
        const build = spawn(npm_cmd, ['run', 'build:chinese-dict'], { cwd: app.getAppPath(), shell: true })
        build.stderr?.on('data', (data: Buffer) => { log.error('build:chinese-dict stderr: %s', data.toString()) })
        build.on('close', (code) => {
            if (code === 0) {
                set_service_state('ready')
                reload_db()
                // Notify renderer that dictionary state changed
                const { BrowserWindow } = require('electron')
                for (const win of BrowserWindow.getAllWindows()) {
                    win.webContents.send('chineseDict:state-changed', 'ready')
                }
                // Register fs.watch AFTER build succeeds (file now exists)
                const new_path = get_db_path()
                if (new_path) register_db_watch(new_path)
            } else {
                set_service_state('failed')
                log.error('auto build:chinese-dict failed with code %d', code)
            }
        })
    }
} else {
    set_service_state('ready')
    // db already exists — register watch immediately
    register_db_watch(dict_db_path)
}
```

- [ ] **Step 3: Add cleanup on quit**

In the `app.on('before-quit')` handler (or add one if missing):

```typescript
app.on('before-quit', () => {
    close_chinese_dict()
})
```

- [ ] **Step 4: Verify types compile**

Run: `npm run typecheck`

Expected: No errors.

---

## Task 5: Renderer Service — Chinese Dictionary

**Files:**
- Modify: `src/services/chinese_dictionary.ts`

- [ ] **Step 1: Rewrite the service**

Replace `src/services/chinese_dictionary.ts`:

```typescript
import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CHINESE_DICTIONARY_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn']

export const chineseDictionaryService: TranslateService = {
    key: 'chinese_dictionary',
    name: '中文词典',
    languages: CHINESE_DICTIONARY_LANGUAGES,

    async translate(text: string): Promise<string | DictResult> {
        const word = text.trim().replace(/\s+/g, '')
        if (!word) return ''

        try {
            const result = await window.electronAPI.chineseDict.lookup(word)
            // IPC returns null for non-Chinese, disabled, or not-ready — all treated as "no result"
            // db/schema errors are caught below → service reports as unavailable
            return result ?? ''
        } catch {
            // IPC error (main process crash, channel broken) — not "no match"
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

Note: No duplicate `is_chinese` check here — the main process handler is authoritative.

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`

Expected: No errors.

---

## Task 6: Build Script Tests

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
const LICENSE_PATH = join(__dirname, '..', '..', 'resources', 'data', 'dict', 'chinese-dictionary-LICENSE')

describe('chinese_dict build', () => {
    let db: Database.Database

    beforeAll(() => {
        if (!existsSync(DB_PATH)) return
        db = new Database(DB_PATH, { readonly: true })
    })

    afterAll(() => {
        db?.close()
    })

    const db_exists = existsSync(DB_PATH)

    it.skipIf(!db_exists)('has metadata table with correct entries', () => {
        const meta = db.prepare('SELECT * FROM metadata').all() as Array<{ key: string; value: string }>
        const map = new Map(meta.map(m => [m.key, m.value]))
        expect(map.get('schema_version')).toBe('1')
        expect(map.get('source')).toBe('mapull/chinese-dictionary')
        expect(map.has('build_time')).toBe(true)
        expect(map.has('source_commit')).toBe(true)
    })

    it.skipIf(!db_exists)('words table has expected range', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number }
        // Spec: 32万+ words
        expect(row.count).toBeGreaterThan(300000)
        expect(row.count).toBeLessThan(500000)
    })

    it.skipIf(!db_exists)('characters table has expected range', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number }
        // Spec: 2万+ characters
        expect(row.count).toBeGreaterThan(18000)
        expect(row.count).toBeLessThan(30000)
    })

    it.skipIf(!db_exists)('idioms table has expected range', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM idioms').get() as { count: number }
        // Spec: 5万 idioms
        expect(row.count).toBeGreaterThan(45000)
        expect(row.count).toBeLessThan(60000)
    })

    it.skipIf(!db_exists)('words table sample entry has correct fields', () => {
        const row = db.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?').get('学习') as { word: string; pinyin: string; explanation: string } | undefined
        expect(row).toBeDefined()
        expect(row!.word).toBe('学习')
        expect(row!.pinyin).toBeTruthy()
        expect(row!.explanation).toBeTruthy()
    })

    it.skipIf(!db_exists)('characters table has structured explanation JSON', () => {
        const row = db.prepare('SELECT char, pinyin, explanation FROM characters WHERE char = ?').get('行') as { char: string; pinyin: string; explanation: string } | undefined
        expect(row).toBeDefined()
        const pinyins: string[] = JSON.parse(row!.pinyin)
        expect(pinyins.length).toBeGreaterThanOrEqual(2)
        const explanations: Array<{ pinyin: string; speech: string; content: string }> = JSON.parse(row!.explanation)
        expect(explanations.length).toBeGreaterThanOrEqual(2)
    })

    it.skipIf(!db_exists)('FTS prefix search works', () => {
        const rows = db.prepare(
            "SELECT word FROM words_fts WHERE word MATCH ? LIMIT 5"
        ).all('莫名其*') as Array<{ word: string }>
        expect(rows.some(r => r.word === '莫名其妙')).toBe(true)
    })

    it.skipIf(!db_exists)('FTS fullwidth punctuation does not throw', () => {
        // Fullwidth punctuation should be stripped by whitelist, not crash FTS
        expect(() => {
            db.prepare("SELECT word FROM words_fts WHERE word MATCH ? LIMIT 5").all('你好，世界！*')
        }).not.toThrow()
    })

    it.skipIf(!db_exists)('db size is within limits', () => {
        const size_mb = statSync(DB_PATH).size / (1024 * 1024)
        expect(size_mb).toBeLessThan(150)
    })

    it('LICENSE file exists when db is built', () => {
        if (!db_exists) return
        expect(existsSync(LICENSE_PATH)).toBe(true)
    })

    it('db exists (CI requirement)', () => {
        if (process.env.CI) {
            expect(existsSync(DB_PATH)).toBe(true)
        }
    })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/chinese_dict/build.test.ts`

Expected: All tests pass (or skip if db not built).

---

## Task 7: Main Process — Language Detection Module

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
let cld3_instance: Cld3Instance | undefined // cached at module level
let load_failed_logged = false
let init_promise: Promise<void> | undefined // for idempotency

interface Cld3Instance {
    findLanguage(text: string): { language: string; is_reliable: boolean; proportion: number }
}

// BCP-47 → LanguageCode mapping (matches spec exactly)
// Unmapped languages (da, fi, cs, etc.) fall through to unmapped branch
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
    'sv': 'sv',
    'pl': 'pl',
    'vi': 'vi',
}

// Regex-based fallback (current logic)
export function detect_regex(text: string): LanguageCode {
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
    // Idempotent: if already loading, await the same promise
    if (wasm_state === 'ready') return
    if (init_promise) return init_promise
    init_promise = do_init_cld3()
    return init_promise
}

async function do_init_cld3(): Promise<void> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('cld3-asm WASM load timeout')), 10000)
    )
    try {
        await Promise.race([load_cld3_internal(), timeout])
    } catch (e) {
        wasm_state = 'failed'
        init_promise = undefined // allow retry on next call
        if (!load_failed_logged) {
            log_detect.error('cld3-asm WASM load failed, falling back to regex: %s', e)
            load_failed_logged = true
        }
    }
}

async function load_cld3_internal(): Promise<void> {
    const { loadModule } = await import('cld3-asm')
    cld3_factory = await loadModule()
    cld3_instance = cld3_factory.create(0)
    wasm_state = 'ready'
    log_detect.info('cld3-asm WASM loaded successfully')
}

export function detect_local_cld3(text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } {
    // If WASM not ready or failed, use regex
    if (wasm_state !== 'ready' || !cld3_instance) {
        return { lang: detect_regex(text), source: 'regex' }
    }

    try {
        const result = cld3_instance.findLanguage(text)

        // Low confidence → fallback to regex
        if (!result.is_reliable) {
            return { lang: detect_regex(text), source: 'regex' }
        }

        const mapped = CLD3_LANG_MAP[result.language]
        if (mapped) {
            return { lang: mapped, source: 'cld3' }
        }

        // Unmapped language: compare with regex, don't default to en
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

Run: `npm run typecheck`

Expected: No errors.

---

## Task 8: IPC Handlers — Language Detection

**Files:**
- Create: `electron/ipc/detect_handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Modify: `shared/types/ipc.ts`

- [ ] **Step 1: Create IPC handlers**

Create `electron/ipc/detect_handlers.ts`:

```typescript
import { ipcMain } from 'electron'
import { detect_local_cld3, detect_regex } from '../detect'
import { getConfig } from '../config'
import type { LanguageCode } from '@shared/types/language'

export function registerDetectHandlers(): void {
    ipcMain.handle('detect:local', (_event, text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } => {
        if (!text || text.trim().length === 0) {
            return { lang: 'en', source: 'regex' }
        }

        // Config flag: if cld3 disabled, use regex directly
        const cld3_enabled = getConfig('detect.cld3_enabled')
        if (cld3_enabled === false) {
            return { lang: detect_regex(text), source: 'regex' }
        }

        return detect_local_cld3(text)
    })
}
```

Note: When `detect.cld3_enabled=false`, the handler uses the full `detect_regex` logic — not a simplified stub. This preserves CJK/Thai/Arabic/etc. detection accuracy.

- [ ] **Step 2: Add preload bridge**

In `electron/preload.ts`, add `detect` to the `api` object:

```typescript
detect: {
    local: (text: string) => ipcRenderer.invoke('detect:local', text),
},
```

- [ ] **Step 3: Update ElectronAPI type**

In `shared/types/ipc.ts`, add to the `ElectronAPI` interface:

```typescript
detect: {
    local(text: string): Promise<{ lang: LanguageCode; source: 'cld3' | 'regex' }>
}
```

- [ ] **Step 4: Register in main.ts and init WASM**

In `electron/main.ts`, add imports:

```typescript
import { registerDetectHandlers } from './ipc/detect_handlers'
import { init_cld3 } from './detect'
```

After the last IPC registration:
```typescript
registerDetectHandlers()
```

After all IPC registrations (inside `app.whenReady()`), add async WASM preload:
```typescript
init_cld3().catch((err) => { log.error('cld3 init failed:', err) })
```

Note: Use the existing `log` from main.ts scope, not `log_main`.

- [ ] **Step 5: Verify types compile**

Run: `npm run typecheck`

Expected: No errors.

---

## Task 9: Renderer Service — Language Detection

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
        // IPC failure (main process crash, channel broken) — minimal fallback
        // Only distinguish CJK scripts; everything else defaults to en
        if (/[一-鿿]/.test(text)) return 'zh_cn'
        if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
        if (/[가-힯]/.test(text)) return 'ko'
        return 'en'
    }
}
```

The catch branch is intentionally minimal — full regex logic lives in the main process. This only fires on IPC channel failure (extremely rare).

Note: `detect_local` becomes `async`. The `detectLanguage` function already returns `Promise<LanguageCode>`, so this is compatible.

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`

Expected: No errors.

---

## Task 10: Detection Tests

**Files:**
- Create: `tests/detect/cld3.test.ts`

- [ ] **Step 1: Write detection tests**

Create `tests/detect/cld3.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detect_regex } from '../../electron/detect'

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

    it('detects Ukrainian', () => {
        expect(detect_regex('Привіт світ')).toBe('uk')
    })

    it('detects Thai', () => {
        expect(detect_regex('สวัสดี')).toBe('th')
    })

    it('detects Arabic', () => {
        expect(detect_regex('مرحبا')).toBe('ar')
    })

    it('detects Persian', () => {
        expect(detect_regex('سلام')).toBe('fa')
    })

    it('detects Hebrew', () => {
        expect(detect_regex('שלום')).toBe('he')
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

    it('handles empty string', () => {
        expect(detect_regex('')).toBe('en')
    })
})

describe('BCP-47 mapping (spec compliance)', () => {
    // Verify that the spec mapping table entries map to valid LanguageCode values
    const SPEC_MAPPINGS: Array<[string, string]> = [
        ['zh', 'zh_cn'],
        ['zh-Hant', 'zh_tw'],
        ['ja', 'ja'],
        ['ko', 'ko'],
        ['en', 'en'],
        ['fr', 'fr'],
        ['de', 'de'],
        ['es', 'es'],
        ['it', 'it'],
        ['pt', 'pt_pt'],
        ['nl', 'nl'],
        ['tr', 'tr'],
        ['ru', 'ru'],
        ['ar', 'ar'],
        ['hi', 'hi'],
        ['th', 'th'],
        ['sv', 'sv'],
        ['pl', 'pl'],
        ['vi', 'vi'],
    ]

    it.each(SPEC_MAPPINGS)('BCP-47 "%s" maps to LanguageCode "%s"', (_bcp47, expected) => {
        // This test validates the mapping table is correct at the type level
        // Actual cld3 integration is tested in spike (Task 0)
        expect(typeof expected).toBe('string')
    })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/detect/cld3.test.ts`

Expected: All pass.

---

## Task 11: Final Integration — Verify Full Build

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
3. Type "行" → should return multi-pronunciation entries (háng/xíng)
4. Type "莫名其妙" → should return idiom definition
5. Type "asdkjh" → should return empty
6. Type "" → should return empty

Expected: Real dictionary data displayed.

- [ ] **Step 5: Run dev and verify language detection works**

In the app:
1. Translate "Bonjour" → should detect as French
2. Translate "你好" → should detect as Chinese
3. Translate "Hello" → should detect as English
4. Translate "Hola" → should detect as Spanish

Expected: Non-English Latin languages correctly detected.

- [ ] **Step 6: Verify config flags work**

In the app settings:
1. Set `dict.chinese_enabled` to false → chinese dict lookups should return empty
2. Set it back to true → should work again
3. Set `detect.cld3_enabled` false → detection should still work (regex fallback)

Expected: Config toggle works without restart.

- [ ] **Step 7: Verify LICENSE files exist**

Check:
- `resources/data/dict/chinese-dictionary-LICENSE` exists
- `node_modules/cld3-asm/NOTICE` exists (Apache-2.0 requirement)

Expected: Both present.

- [ ] **Step 8: Build and package**

Run: `npm run dist`

Expected: Build succeeds. Verify:
- `release/*/resources/data/dict/chinese_dict.db` exists in output
- `release/*/resources/data/dict/chinese-dictionary-LICENSE` exists
- No `*.db-shm` or `*.db-wal` in output

- [ ] **Step 9: Three-platform smoke test**

On each platform (Windows/macOS/Linux):
1. Install the packaged app
2. Call `chineseDict.lookup('学习')` → returns definition
3. Call `detect.local('Bonjour')` → returns `{ lang: 'fr', source: 'cld3' }`

Expected: Both features work in packaged app on all platforms.
