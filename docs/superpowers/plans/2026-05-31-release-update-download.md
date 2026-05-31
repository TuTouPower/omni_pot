# Release Update Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved dual-source GitHub/R2 release publishing and App update detection, and provide exact website handoff instructions without modifying the website repo.

**Architecture:** Keep the App on full-package updates. Add a small release metadata layer shared by publishing tests and updater parsing, then teach the updater to read `latest.json` from GitHub and R2 with conflict detection and R2 download fallback. Keep website work out of this repo execution; output a concise handoff for the website AI to apply current versioned R2 links.

**Tech Stack:** Electron 39, TypeScript 6, Vitest, Node ESM scripts, GitHub CLI/API, Cloudflare Wrangler/R2.

---

## File Map

- Create `scripts/release_metadata.mjs`: pure helpers for file discovery, sha256, `latest.json` generation, R2/GitHub URL building, and metadata validation.
- Create `scripts/publish_release.mjs`: local CLI orchestration for `dist`, GitHub release/assets, R2 upload, and remote read-back verification. Real upload requires explicit invocation and credentials.
- Modify `package.json`: add `release:publish` script.
- Modify `electron/updater/index.ts`: add dual-source `latest.json` fetching, metadata parsing, source conflict handling, R2 URL allowlist, and portable asset selection.
- Modify `tests/unit/updater.test.ts`: cover R2 allowlist, metadata format, dual-source selection, conflict rejection, and portable asset choice.
- Create `tests/unit/packaging/release_metadata.test.ts`: cover metadata helper behavior without network.
- Modify `docs/release.md`: document the new local publish flow, credentials, dry-run, R2 paths, rollback policy.
- Modify `CLAUDE.md`: update command table with `npm run release:publish` if the script is added.

---

### Task 1: Release metadata helpers

**Files:**
- Create: `scripts/release_metadata.mjs`
- Create: `tests/unit/packaging/release_metadata.test.ts`

- [ ] **Step 1: Write failing tests for metadata generation**

Add `tests/unit/packaging/release_metadata.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const module_path = new URL('../../../scripts/release_metadata.mjs', import.meta.url).pathname

describe('release metadata helpers', () => {
    it('builds latest metadata with dynamic sha256 and CST released_at', async () => {
        const { build_latest_metadata } = await import(module_path)
        const dir = await mkdtemp(join(tmpdir(), 'omni-pot-release-'))
        try {
            const installer_path = join(dir, 'OmniPot{VERSION}.exe')
            const portable_path = join(dir, 'OmniPot{VERSION}-portable.exe')
            await writeFile(installer_path, 'installer')
            await writeFile(portable_path, 'portable')

            const metadata = await build_latest_metadata({
                version: '{VERSION}',
                release_dir: dir,
                released_at: new Date('2026-05-31T00:00:00.000Z'),
            })

            expect(metadata.format_version).toBe(1)
            expect(metadata.version).toBe('{VERSION}')
            expect(metadata.released_at).toBe('2026-05-31T08:00:00.000+08:00')
            expect(metadata.files.windows_installer.filename).toBe('OmniPot{VERSION}.exe')
            expect(metadata.files.windows_installer.versioned_filename).toBe('OmniPot{VERSION}.exe')
            expect(metadata.files.windows_installer.size).toBe(9)
            expect(metadata.files.windows_installer.sha256).toMatch(/^[a-f0-9]{64}$/)
            expect(metadata.files.windows_installer.r2_url).toBe('https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}.exe')
            expect(metadata.files.windows_portable.filename).toBe('OmniPot{VERSION}-portable.exe')
            expect(metadata.files.windows_portable.versioned_filename).toBe('OmniPot{VERSION}-portable.exe')
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })

    it('rejects missing installer or portable files', async () => {
        const { build_latest_metadata } = await import(module_path)
        const dir = await mkdtemp(join(tmpdir(), 'omni-pot-release-'))
        try {
            await writeFile(join(dir, 'OmniPot{VERSION}.exe'), 'installer')
            await expect(build_latest_metadata({ version: '{VERSION}', release_dir: dir })).rejects.toThrow('portable')
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })

    it('writes latest.json using stable pretty JSON', async () => {
        const { write_latest_json } = await import(module_path)
        const dir = await mkdtemp(join(tmpdir(), 'omni-pot-release-'))
        try {
            const path = await write_latest_json(dir, { format_version: 1, version: '{VERSION}', released_at: '2026-05-31T00:00:00.000Z', files: {} })
            expect(await readFile(path, 'utf8')).toContain('    "format_version": 1')
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/packaging/release_metadata.test.ts
```

Expected: FAIL because `scripts/release_metadata.mjs` does not exist.

- [ ] **Step 3: Implement release metadata helpers**

Create `scripts/release_metadata.mjs`:

```js
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const r2_base_url = 'https://downloads.zzzkkkccc.site/omni-pot'
const github_base_url = 'https://github.com/TuTouPower/omni_pot_release/releases/download'

function sha256_file(path) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256')
        const stream = createReadStream(path)
        stream.on('data', (chunk) => { hash.update(chunk) })
        stream.on('error', reject)
        stream.on('end', () => { resolve(hash.digest('hex')) })
    })
}

async function find_release_file(release_dir, version, kind) {
    const entries = await readdir(release_dir)
    const exe_files = entries.filter((name) => name.endsWith('.exe'))
    const portable_files = exe_files.filter((name) => name.toLowerCase().includes('portable'))
    const installer_files = exe_files.filter((name) => !name.toLowerCase().includes('portable'))
    const candidates = kind === 'portable' ? portable_files : installer_files
    const version_candidates = candidates.filter((name) => name.includes(version))
    const matches = version_candidates.length > 0 ? version_candidates : candidates
    if (matches.length !== 1) throw new Error(`Expected one ${kind} release file, found ${String(matches.length)}`)
    return join(release_dir, matches[0])
}

async function build_file_metadata({ path, version, filename, versioned_filename }) {
    const info = await stat(path)
    const sha256 = await sha256_file(path)
    return {
        filename,
        versioned_filename,
        source_path: path,
        sha256,
        size: info.size,
        github_url: `${github_base_url}/v${version}/${versioned_filename}`,
        r2_url: `${r2_base_url}/latest/${filename}`,
        r2_version_key: `omni-pot/${version}/${versioned_filename}`,
        r2_latest_key: `omni-pot/latest/${filename}`,
    }
}

export async function build_latest_metadata({ version, release_dir = 'release', released_at = new Date() }) {
    const installer_path = await find_release_file(release_dir, version, 'installer')
    const portable_path = await find_release_file(release_dir, version, 'portable')
    return {
        format_version: 1,
        version,
        released_at: to_cst_iso(released_at),
        files: {
            windows_installer: await build_file_metadata({ path: installer_path, version, filename: `OmniPot${version}.exe`, versioned_filename: `OmniPot${version}.exe` }),
            windows_portable: await build_file_metadata({ path: portable_path, version, filename: `OmniPot${version}-portable.exe`, versioned_filename: `OmniPot${version}-portable.exe` }),
        },
    }
}

export async function write_latest_json(release_dir, metadata) {
    const path = join(release_dir, 'latest.json')
    await writeFile(path, `${JSON.stringify(metadata, null, 4)}\n`)
    return path
}

export function public_metadata(metadata) {
    return {
        format_version: metadata.format_version,
        version: metadata.version,
        released_at: metadata.released_at,
        files: Object.fromEntries(Object.entries(metadata.files).map(([key, file]) => [key, {
            filename: file.filename,
            versioned_filename: file.versioned_filename,
            sha256: file.sha256,
            size: file.size,
            github_url: file.github_url,
            r2_url: file.r2_url,
        }])),
    }
}
```

- [ ] **Step 4: Run metadata tests**

Run:

```bash
npm test -- tests/unit/packaging/release_metadata.test.ts
```

Expected: PASS.

---

### Task 2: Local publish script

**Files:**
- Create: `scripts/publish_release.mjs`
- Modify: `package.json`
- Test: `tests/unit/packaging/release_metadata.test.ts`

- [ ] **Step 1: Add script-level tests for upload plan paths**

Extend `tests/unit/packaging/release_metadata.test.ts` with:

```ts
it('builds deterministic R2 keys for version archive and latest objects', async () => {
    const { build_latest_metadata } = await import(module_path)
    const dir = await mkdtemp(join(tmpdir(), 'omni-pot-release-'))
    try {
        await writeFile(join(dir, 'OmniPot{VERSION}.exe'), 'installer')
        await writeFile(join(dir, 'OmniPot{VERSION}-portable.exe'), 'portable')
        const metadata = await build_latest_metadata({ version: '{VERSION}', release_dir: dir, released_at: new Date('2026-05-31T00:00:00.000Z') })
        expect(metadata.files.windows_installer.r2_version_key).toBe('omni-pot/{VERSION}/OmniPot{VERSION}.exe')
        expect(metadata.files.windows_installer.r2_latest_key).toBe('omni-pot/latest/OmniPot{VERSION}.exe')
        expect(metadata.files.windows_portable.r2_version_key).toBe('omni-pot/{VERSION}/OmniPot{VERSION}-portable.exe')
        expect(metadata.files.windows_portable.r2_latest_key).toBe('omni-pot/latest/OmniPot{VERSION}-portable.exe')
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
})
```

- [ ] **Step 2: Run test to verify it passes after Task 1 helper supports keys**

Run:

```bash
npm test -- tests/unit/packaging/release_metadata.test.ts
```

Expected: PASS if Task 1 implemented keys exactly; otherwise fix `scripts/release_metadata.mjs`.

- [ ] **Step 3: Add local publishing CLI**

Create `scripts/publish_release.mjs`:

```js
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { build_latest_metadata, public_metadata, write_latest_json } from './release_metadata.mjs'

const use_shell = process.platform === 'win32'

function arg_value(name) {
    const index = process.argv.indexOf(name)
    return index >= 0 ? process.argv[index + 1] : undefined
}

function has_arg(name) {
    return process.argv.includes(name)
}

function run(command, args, { dry_run = false } = {}) {
    const rendered = [command, ...args].join(' ')
    if (dry_run) {
        console.log(`[dry-run] ${rendered}`)
        return
    }
    const result = spawnSync(command, args, { stdio: 'inherit', shell: use_shell })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${rendered} failed with ${String(result.status)}`)
}

async function fetch_json(url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'omni_pot-release-publisher' } })
    if (!response.ok) throw new Error(`GET ${url} failed: ${String(response.status)}`)
    return response.json()
}

function assert_remote_metadata(local, github, r2) {
    const expected = JSON.stringify(local)
    const github_text = JSON.stringify(github)
    const r2_text = JSON.stringify(r2)
    if (github_text !== expected) throw new Error('GitHub latest.json does not match local metadata')
    if (r2_text !== expected) throw new Error('R2 latest.json does not match local metadata')
}

async function package_version() {
    const package_json = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8'))
    if (typeof package_json.version !== 'string' || package_json.version.length === 0) throw new Error('Missing package.json version')
    return package_json.version
}

async function main() {
    const version = await package_version()
    const requested_version = arg_value('--version')
    if (requested_version && requested_version !== version) throw new Error(`--version ${requested_version} does not match package.json version ${version}`)
    const dry_run = has_arg('--dry-run')
    const skip_dist = has_arg('--skip-dist')
    const release_dir = arg_value('--release-dir') ?? 'release'

    if (!skip_dist) run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dist'], { dry_run })

    const metadata = await build_latest_metadata({ version, release_dir })
    const latest_json = await write_latest_json(release_dir, public_metadata(metadata))
    const tag = `v${version}`

    run('gh', ['release', 'view', tag, '--repo', 'TuTouPower/omni_pot_release'], { dry_run: dry_run || true })
    if (!dry_run) {
        const view = spawnSync('gh', ['release', 'view', tag, '--repo', 'TuTouPower/omni_pot_release'], { stdio: 'ignore', shell: use_shell })
        if (view.status !== 0) run('gh', ['release', 'create', tag, '--repo', 'TuTouPower/omni_pot_release', '--title', `Omni Pot ${version}`, '--notes', `Omni Pot ${version}`])
    }

    for (const file of Object.values(metadata.files)) {
        run('gh', ['release', 'upload', tag, file.source_path, '--repo', 'TuTouPower/omni_pot_release', '--clobber'], { dry_run })
    }
    run('gh', ['release', 'upload', tag, latest_json, '--repo', 'TuTouPower/omni_pot_release', '--clobber'], { dry_run })

    for (const file of Object.values(metadata.files)) {
        run('npx', ['wrangler', 'r2', 'object', 'put', `releases/${file.r2_version_key}`, '--file', file.source_path, '--remote'], { dry_run })
    }
    run('npx', ['wrangler', 'r2', 'object', 'put', 'releases/omni-pot/latest.json', '--file', latest_json, '--remote'], { dry_run })
    for (const file of Object.values(metadata.files)) {
        run('npx', ['wrangler', 'r2', 'object', 'put', `releases/${file.r2_latest_key}`, '--file', file.source_path, '--remote'], { dry_run })
    }

    if (!dry_run) {
        const local = JSON.parse(await readFile(latest_json, 'utf8'))
        const github = await fetch_json(`https://github.com/TuTouPower/omni_pot_release/releases/download/${tag}/latest.json`)
        const r2 = await fetch_json('https://downloads.zzzkkkccc.site/omni-pot/latest.json')
        assert_remote_metadata(local, github, r2)
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
```

- [ ] **Step 4: Add npm script**

Modify `package.json` scripts:

```json
"release:publish": "node scripts/publish_release.mjs"
```

Place it near `dist` scripts.

- [ ] **Step 5: Run dry-run command**

Run:

```bash
npm run release:publish -- --skip-dist --dry-run
```

Expected: command prints planned GitHub/R2 operations. If local `release/` has no current artifacts, expected failure is `Expected one installer release file`; this is acceptable before running `npm run dist`.

---

### Task 3: Updater dual-source metadata

**Files:**
- Modify: `electron/updater/index.ts`
- Modify: `tests/unit/updater.test.ts`

- [ ] **Step 1: Add failing tests for R2 allowlist and metadata parsing**

Extend `tests/unit/updater.test.ts`:

```ts
it('allows R2 update URLs before redirect', async () => {
    const { assert_allowed_download_url } = await import('../../electron/updater')
    expect(assert_allowed_download_url('https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}.exe', false).hostname).toBe('downloads.zzzkkkccc.site')
    expect(() => { assert_allowed_download_url('https://downloads.zzzkkkccc.site/other/file.exe', false) }).toThrow('Unsupported update download URL')
})

it('parses supported latest metadata into installer and portable assets', async () => {
    const { parse_latest_metadata } = await import('../../electron/updater')
    const release = parse_latest_metadata({
        format_version: 1,
        version: '1.1.0',
        released_at: '2026-05-31T00:00:00.000Z',
        files: {
            windows_installer: { filename: 'OmniPot1.1.0.exe', versioned_filename: 'OmniPot1.1.0.exe', sha256: 'a'.repeat(64), size: 85000000, github_url: 'https://github.com/TuTouPower/omni_pot_release/releases/download/v1.1.0/OmniPot1.1.0.exe', r2_url: 'https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot1.1.0.exe' },
            windows_portable: { filename: 'OmniPot1.1.0-portable.exe', versioned_filename: 'OmniPot1.1.0-portable.exe', sha256: 'b'.repeat(64), size: 85000000, github_url: 'https://github.com/TuTouPower/omni_pot_release/releases/download/v1.1.0/OmniPot1.1.0-portable.exe', r2_url: 'https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot1.1.0-portable.exe' },
        },
    }, 'r2', '{VERSION}')
    expect(release?.version).toBe('1.1.0')
    expect(release?.assets[0]).toMatchObject({ name: 'OmniPot1.1.0.exe', digest: `sha256:${'a'.repeat(64)}` })
})

it('rejects unsupported latest metadata format', async () => {
    const { parse_latest_metadata } = await import('../../electron/updater')
    expect(() => { parse_latest_metadata({ format_version: 2 }, 'r2', '{VERSION}') }).toThrow('Unsupported update metadata format')
})
```

- [ ] **Step 2: Add failing tests for source selection**

Add:

```ts
it('selects matching dual-source metadata and rejects conflicts', async () => {
    const { select_update_release } = await import('../../electron/updater')
    const base_release = {
        version: '1.1.0',
        current_version: '{VERSION}',
        name: 'Omni Pot 1.1.0',
        body: '',
        html_url: 'https://github.com/TuTouPower/omni_pot_release/releases/tag/v1.1.0',
        published_at: '2026-05-31T00:00:00.000Z',
        assets: [{ name: 'OmniPot1.1.0.exe', url: 'https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot1.1.0.exe', size: 1, digest: `sha256:${'a'.repeat(64)}` }],
    }
    expect(select_update_release([base_release, { ...base_release }])?.version).toBe('1.1.0')
    expect(() => { select_update_release([base_release, { ...base_release, assets: [{ ...base_release.assets[0], digest: `sha256:${'b'.repeat(64)}` }] }]) }).toThrow('Update metadata conflict')
})
```

- [ ] **Step 3: Run updater tests to verify failure**

Run:

```bash
npm test -- tests/unit/updater.test.ts
```

Expected: FAIL because exported helpers do not exist and R2 allowlist is missing.

- [ ] **Step 4: Implement updater metadata parsing and allowlist**

Modify `electron/updater/index.ts`:

```ts
const R2_LATEST_URL = 'https://downloads.zzzkkkccc.site/omni-pot/latest.json'
const GITHUB_LATEST_JSON_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/latest.json`

type UpdateSource = 'github' | 'r2'

interface LatestMetadataFile {
    filename: string
    versioned_filename: string
    sha256: string
    size: number
    github_url: string
    r2_url: string
}

interface LatestMetadata {
    format_version: number
    version: string
    released_at: string
    files: {
        windows_installer: LatestMetadataFile
        windows_portable: LatestMetadataFile
    }
}

function is_r2_update_url(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'downloads.zzzkkkccc.site' && url.pathname.startsWith('/omni-pot/')
}
```

Update `assert_allowed_download_url`:

```ts
if (!is_redirect && is_r2_update_url(parsed_url)) return parsed_url
```

Export helpers:

```ts
function assert_sha256(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('Invalid update asset digest')
    return value.toLowerCase()
}

function parse_latest_file(value: unknown): LatestMetadataFile {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid update metadata file')
    const record = value as Record<string, unknown>
    if (typeof record.filename !== 'string') throw new Error('Invalid update metadata filename')
    if (typeof record.versioned_filename !== 'string') throw new Error('Invalid update metadata versioned filename')
    if (typeof record.size !== 'number' || record.size <= 0) throw new Error('Invalid update metadata size')
    if (typeof record.github_url !== 'string') throw new Error('Invalid update metadata GitHub URL')
    if (typeof record.r2_url !== 'string') throw new Error('Invalid update metadata R2 URL')
    return {
        filename: record.filename,
        versioned_filename: record.versioned_filename,
        sha256: assert_sha256(record.sha256),
        size: record.size,
        github_url: record.github_url,
        r2_url: record.r2_url,
    }
}

function is_portable_runtime(): boolean {
    return process.platform === 'win32' && typeof process.env['PORTABLE_EXECUTABLE_DIR'] === 'string' && process.env['PORTABLE_EXECUTABLE_DIR'].length > 0
}

export function parse_latest_metadata(value: unknown, source: UpdateSource, current_version: string): UpdateReleaseInfo | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid update metadata')
    const record = value as Record<string, unknown>
    if (record.format_version !== 1) throw new Error('Unsupported update metadata format')
    if (typeof record.version !== 'string') throw new Error('Invalid update metadata version')
    if (typeof record.released_at !== 'string') throw new Error('Invalid update metadata release date')
    if (!compare_versions(current_version, record.version)) return null
    const files = record.files as Record<string, unknown> | undefined
    if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Invalid update metadata files')
    const installer = parse_latest_file(files.windows_installer)
    const portable = parse_latest_file(files.windows_portable)
    const selected = is_portable_runtime() ? portable : installer
    const fallback_url = source === 'r2' ? selected.github_url : selected.r2_url
    return {
        version: record.version,
        current_version,
        name: `Omni Pot ${record.version}`,
        body: '',
        html_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${record.version}`,
        published_at: record.released_at,
        assets: [
            { name: selected.filename, url: selected.r2_url, size: selected.size, digest: `sha256:${selected.sha256}` },
            { name: selected.versioned_filename, url: selected.github_url, size: selected.size, digest: `sha256:${selected.sha256}` },
            { name: `fallback-${selected.filename}`, url: fallback_url, size: selected.size, digest: `sha256:${selected.sha256}` },
        ],
    }
}

export function select_update_release(releases: Array<UpdateReleaseInfo | null>): UpdateReleaseInfo | null {
    const available = releases.filter((release): release is UpdateReleaseInfo => release !== null)
    if (available.length === 0) return null
    if (available.length === 1) return available[0]
    const [first, ...rest] = available
    const first_asset = first.assets[0]
    for (const release of rest) {
        const asset = release.assets[0]
        if (release.version !== first.version || asset?.digest !== first_asset?.digest || asset?.size !== first_asset?.size) {
            throw new Error('Update metadata conflict')
        }
    }
    return first
}
```

- [ ] **Step 5: Replace GitHub API release fetch with dual latest.json fetch**

Replace `get_update_release_info()` with:

```ts
async function fetch_latest_metadata(url: string, source: UpdateSource, current_version: string): Promise<UpdateReleaseInfo | null> {
    const resp = await fetch(url, { headers: { 'User-Agent': 'omni_pot-updater' } })
    if (!resp.ok) throw new Error(`HTTP ${String(resp.status)}`)
    return parse_latest_metadata(await resp.json(), source, current_version)
}

async function get_update_release_info(): Promise<UpdateReleaseInfo | null> {
    const current_version = app.getVersion()
    const results = await Promise.allSettled([
        fetch_latest_metadata(GITHUB_LATEST_JSON_URL, 'github', current_version),
        fetch_latest_metadata(R2_LATEST_URL, 'r2', current_version),
    ])
    const releases = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    if (releases.length === 0 && results.some((result) => result.status === 'rejected')) {
        throw new Error(results.map((result) => result.status === 'rejected' ? String(result.reason) : '').filter(Boolean).join('; '))
    }
    return select_update_release(releases)
}
```

- [ ] **Step 6: Run updater tests**

Run:

```bash
npm test -- tests/unit/updater.test.ts
```

Expected: PASS.

---

### Task 4: Updater download fallback and UI asset behavior

**Files:**
- Modify: `electron/updater/index.ts`
- Modify: `src/windows/updater/index.tsx`
- Modify: `tests/unit/updater.test.ts`

- [ ] **Step 1: Add a test for resolving fallback assets**

Add to `tests/unit/updater.test.ts`:

```ts
it('binds primary and fallback assets but exposes primary asset first', async () => {
    const { bind_update_release_assets, resolve_bound_update_asset } = await import('../../electron/updater')
    bind_update_release_assets([
        { name: 'OmniPot1.1.0.exe', url: 'https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot1.1.0.exe', digest: `sha256:${'a'.repeat(64)}` },
        { name: 'OmniPot1.1.0.exe', url: 'https://github.com/TuTouPower/omni_pot_release/releases/download/v1.1.0/OmniPot1.1.0.exe', digest: `sha256:${'a'.repeat(64)}` },
    ])
    expect(resolve_bound_update_asset('OmniPot1.1.0.exe').url).toContain('downloads.zzzkkkccc.site')
    expect(resolve_bound_update_asset('OmniPot1.1.0.exe').url).toContain('github.com')
})
```

- [ ] **Step 2: Keep UI downloading the first backend-selected asset**

No UI architecture change is required if `release.assets[0]` is always the desired primary file. Remove direct anchor links for fallback files from the visible card if they confuse users:

```tsx
{release.assets.slice(0, 1).map((asset) => (
```

This keeps fallback bound in the main process but avoids showing duplicate download links.

- [ ] **Step 3: Run updater tests**

Run:

```bash
npm test -- tests/unit/updater.test.ts
```

Expected: PASS.

---

### Task 5: Website AI handoff instructions

**Files:**
- Do not modify website files in this implementation.

- [ ] **Step 1: Prepare handoff text for the website AI**

Give the website AI this exact instruction:

```md
In `/home/karon/karson_ubuntu/public_website/app/page.tsx`, update only the download CTAs.

1. In `Hero`, change the primary download CTA label from `下载 macOS · Win · Linux` to `下载 Windows 版`.
2. In `FooterCTA`, make the Windows button link to `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}.exe`.
3. In `FooterCTA`, do not link macOS/Linux until real artifacts exist. Render them as disabled-looking text/buttons with `aria-disabled="true"` and labels `macOS · 即将推出` and `Linux · 即将推出`.
4. Keep the site static. Do not add Next.js API routes, Worker calls, or runtime version fetching.
5. Run `npm run build` in `/home/karon/karson_ubuntu/public_website` after editing.
```

- [ ] **Step 2: Report handoff text to the user**

Expected: no file changes under `/home/karon/karson_ubuntu/public_website` from this agent.

---

### Task 6: Documentation sync and verification

**Files:**
- Modify: `docs/release.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update release docs**

Add a section to `docs/release.md`:

```md
## 本地双源发布

执行：

```bash
npm run release:publish
```

脚本会构建产物、生成 `release/latest.json`，上传 GitHub Release 与 Cloudflare R2，并远程读回 `latest.json` 校验一致性。

测试发布命令：

```bash
npm run release:publish -- --skip-dist --dry-run
```

R2 路径：

- `omni-pot/<version>/<versioned_filename>`：版本归档
- `omni-pot/latest/OmniPot{VERSION}.exe`：官网和更新默认下载
- `omni-pot/latest/OmniPot{VERSION}-portable.exe`：便携版更新下载
- `omni-pot/latest.json`：更新元数据

失败后脚本不自动回滚。保留 GitHub/R2 现场，由人工确认后修复或撤回。
```

- [ ] **Step 2: Update project command table**

Add to `CLAUDE.md` command table:

```md
| `npm run release:publish` | 本地双源发布到 GitHub Release 与 Cloudflare R2（需要凭据；版本来自 `package.json`） |
```

- [ ] **Step 3: Run targeted tests**

Run:

```bash
npm test -- tests/unit/updater.test.ts tests/unit/packaging/release_metadata.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff -- electron/updater/index.ts src/windows/updater/index.tsx scripts/release_metadata.mjs scripts/publish_release.mjs tests/unit/updater.test.ts tests/unit/packaging/release_metadata.test.ts package.json docs/release.md CLAUDE.md
```

Expected: only release/update/download changes.

---

## Self-Review

- Spec coverage: dual-source metadata, current versioned R2 links, GitHub/R2 publishing, conflict rejection, sha256 validation, portable behavior, URL allowlist, docs sync, and website AI handoff instructions are covered.
- Placeholder scan: no TBD/TODO/fill-in steps remain.
- Type consistency: metadata fields use `format_version`, `version`, `released_at`, `files.windows_installer`, `files.windows_portable`, `sha256`, `size`, `github_url`, and `r2_url` consistently.
- Execution note: actual upload to GitHub/R2 is a shared-state action. Implement and dry-run locally first; do not run a real publish without a separate explicit confirmation.
