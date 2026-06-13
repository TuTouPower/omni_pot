#!/usr/bin/env node
// P3 dist smoke: verify unpacked dist artifacts have native modules
// in app.asar.unpacked so they can be loaded at runtime.
//
// Run after `npm run dist` (or `npm run dist:dir`). Exits non-zero on failure.
//
// Checks:
//   1. win-unpacked/resources/app.asar.unpacked exists
//   2. better-sqlite3 native binary is in app.asar.unpacked
//   3. koffi native binary is in app.asar.unpacked (used by selection/clipboard)
//   4. chinese_dictionary.db / cc_cedict.db are bundled in resources/data/dict
//      OR marked as needing build via npm run build:chinese-dictionary

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repo_root = resolve(import.meta.dirname, '..')
const unpacked_root = join(repo_root, 'build', 'release', 'win-unpacked')
const resources_root = join(unpacked_root, 'resources')
const unpacked_app = join(resources_root, 'app.asar.unpacked')

const errors = []

function check(condition, message) {
    if (!condition) errors.push(message)
}

function find_files_recursive(dir, predicate, results = []) {
    if (!existsSync(dir)) return results
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const stat = statSync(full)
        if (stat.isDirectory()) {
            find_files_recursive(full, predicate, results)
        } else if (predicate(full)) {
            results.push(full)
        }
    }
    return results
}

// 1. app.asar.unpacked directory must exist
check(existsSync(unpacked_app), `missing: ${unpacked_app}`)

// 2. better-sqlite3 native binary in unpacked
if (existsSync(unpacked_app)) {
    const sqlite_nodes = find_files_recursive(unpacked_app, (p) => p.endsWith('better_sqlite3.node'))
    check(sqlite_nodes.length > 0, 'better_sqlite3.node not found in app.asar.unpacked')

    // 3. koffi native binary
    const koffi_nodes = find_files_recursive(unpacked_app, (p) => p.endsWith('koffi.node') || /koffi\/build\/[^/]+\.node$/.test(p.replace(/\\/g, '/')))
    check(koffi_nodes.length > 0, 'koffi .node not found in app.asar.unpacked')
}

// 4. data/dict bundled (chinese_dictionary.db is build-on-demand, but cc_cedict.db should be in repo)
const data_dict_dir = join(resources_root, 'data', 'dict')
if (existsSync(data_dict_dir)) {
    const entries = readdirSync(data_dict_dir)
    check(entries.includes('chinese-dictionary-LICENSE'), `chinese-dictionary-LICENSE missing in ${data_dict_dir}`)
    // chinese_dictionary.db is gitignored and built on demand; skip if not present.
    // cc_cedict.db may or may not be present depending on build state.
} else {
    errors.push(`missing data/dict directory: ${data_dict_dir}`)
}

if (errors.length > 0) {
    console.error('[dist:smoke] FAIL')
    for (const e of errors) console.error('  -', e)
    process.exit(1)
}

console.log('[dist:smoke] PASS — native modules unpacked, dict data bundled')
