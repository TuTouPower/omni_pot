# Directory Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move generated build/package/test artifacts out of root-level paths, archive non-authoritative docs, and merge dictionary resources into `data/dict` while preserving tool-compatible root config and `public/`.

**Architecture:** Use `build/` as the single gitignored generated-output root: `build/app/` replaces `out/`, `build/release/` replaces `release/`, and `build/reports/` replaces Playwright report/result folders. Move dictionary build inputs/outputs from `resources/data/dict/` to `data/dict/`, and update every script, test, package config, and doc reference that consumes those paths. Keep `public/`, root tool config files, `src/`, `scripts/`, `tests/`, and active docs in place.

**Tech Stack:** Electron 39, electron-vite, electron-builder, Playwright, Vitest, TypeScript, Node scripts.

---

## File Structure Map

### Generated artifact paths

- `build/app/` — compiled Electron/Vite app output; replaces `out/`.
- `build/release/` — electron-builder output; replaces `release/`.
- `build/reports/playwright/` — Playwright HTML report; replaces `playwright-report/`.
- `build/reports/e2e-results/` — Playwright traces/screenshots/videos/results; replaces `tests/e2e/test-results/`.

### Dictionary resource paths

- `data/dict/` — dictionary DB source and generated files; replaces `resources/data/dict/`.
- Remove `resources/` if it becomes empty after migration.

### Docs paths

- Keep active docs at `docs/*.md` only when they remain authoritative.
- Move historical/review/one-off docs:
  - `docs/review.md` → `docs/archive/reviews/review.md`
  - `docs/spec_code.md` → `docs/archive/reviews/spec_code.md`
  - `docs/spec_demo.md` → `docs/archive/reviews/spec_demo.md`
  - `docs/refactor_directory_structure.md` → `docs/archive/plan_archives/refactor_directory_structure.md`
  - `docs/better_sqlite3_abi.md` → `docs/runtime/better_sqlite3_abi.md`

### Files expected to change

- `package.json`
- `electron.vite.config.ts`
- `playwright.config.ts`
- `.gitignore`
- `eslint_config.mjs`
- `scripts/run_dist.mjs`
- `scripts/publish_release.mjs`
- `scripts/release_metadata.mjs`
- `scripts/check_dist_locks.mjs`
- `scripts/restart_dist_app.mjs`
- `scripts/build_chinese_dictionary.ts`
- `tests/e2e/global_setup.ts`
- Any source/test/script references found by grep for old paths.
- `CLAUDE.md`
- `docs/test.md`
- `docs/test_e2e.md`
- `docs/release.md`
- `docs/code_quality_checks_plan.md`
- Any doc references found by grep for old paths.

---

## Task 1: Move compiled app output from `out/` to `build/app/`

**Files:**
- Modify: `package.json`
- Modify: `electron.vite.config.ts`
- Modify: `tests/e2e/global_setup.ts`
- Modify: any files found by searching `out/` or `out\\`

- [ ] **Step 1: Update package app entry and builder input**

In `package.json`, change:

```json
"main": "out/main/index.js"
```

to:

```json
"main": "build/app/main/index.js"
```

Also change electron-builder files from:

```json
"files": [
  "out/**",
  "package.json"
]
```

to:

```json
"files": [
  "build/app/**",
  "package.json"
]
```

- [ ] **Step 2: Configure electron-vite output directory**

In `electron.vite.config.ts`, add a shared constant near imports:

```ts
const build_app_dir = 'build/app'
```

Set output directories for all three build targets:

```ts
main: {
    build: {
        outDir: `${build_app_dir}/main`,
        emptyOutDir: true,
        externalizeDeps: true,
        rollupOptions: {
            input: { index: resolve(__dirname, 'src/main/main.ts') },
            external: [resolve(__dirname, 'src/main/selection/darwin'), resolve(__dirname, 'src/main/selection/windows')]
        }
    }
}
```

```ts
preload: {
    build: {
        outDir: `${build_app_dir}/preload`,
        emptyOutDir: false,
        externalizeDeps: true,
        rollupOptions: {
            input: { index: resolve(__dirname, 'src/main/preload.ts') }
        }
    }
}
```

```ts
renderer: {
    build: {
        outDir: `${build_app_dir}/renderer`,
        emptyOutDir: false,
        rollupOptions: {
            input: { index: resolve(__dirname, 'index.html') }
        }
    }
}
```

Keep existing aliases/plugins unchanged.

- [ ] **Step 3: Update e2e global setup build path**

In `tests/e2e/global_setup.ts`, replace the skip-build existence check:

```ts
existsSync(resolve(PROJECT_ROOT, 'out/main/index.js'))
```

with:

```ts
existsSync(resolve(PROJECT_ROOT, 'build/app/main/index.js'))
```

Replace the stderr text:

```ts
'[setup] OMNI_POT_E2E_SKIP_BUILD=1, reusing existing out/\n'
```

with:

```ts
'[setup] OMNI_POT_E2E_SKIP_BUILD=1, reusing existing build/app/\n'
```

Replace the electron-vite args:

```ts
['electron-vite', 'build', '--outDir', 'out']
```

with:

```ts
['electron-vite', 'build', '--outDir', 'build/app']
```

- [ ] **Step 4: Search and update remaining runtime references**

Run:

```bash
git grep -n "out/main/index.js\|out/\|out\\\\"
```

For every non-archive runtime/config/test hit, change to the `build/app` equivalent:

```txt
out/main/index.js      → build/app/main/index.js
out/                   → build/app/
out\\                  → build\\app\\
```

Archive docs may keep historical references only if the text is clearly historical.

- [ ] **Step 5: Verify build output path**

Run:

```bash
npm run build
```

Expected:

```txt
Command exits 0.
build/app/main/index.js exists.
build/app/preload/index.js exists.
build/app/renderer/ exists.
```

---

## Task 2: Move release output from `release/` to `build/release/`

**Files:**
- Modify: `package.json`
- Modify: `scripts/publish_release.mjs`
- Modify: `scripts/release_metadata.mjs`
- Modify: `scripts/check_dist_locks.mjs`
- Modify: `scripts/restart_dist_app.mjs`
- Modify: docs later in Task 6

- [ ] **Step 1: Update electron-builder output directory**

In `package.json`, change:

```json
"directories": {
  "output": "release"
}
```

to:

```json
"directories": {
  "output": "build/release"
}
```

- [ ] **Step 2: Update publish script release directory**

In `scripts/publish_release.mjs`, change:

```js
const release_dir = resolve(cwd(), 'release')
```

to:

```js
const release_dir = resolve(cwd(), 'build/release')
```

Keep all upload logic unchanged.

- [ ] **Step 3: Update release metadata path assumptions**

Search:

```bash
git grep -n "release" -- scripts/release_metadata.mjs
```

If the script only receives `release_dir` as an argument, do not add new logic. If it constructs root `release` paths internally, replace them with the passed `release_dir` or `resolve(cwd(), 'build/release')`.

- [ ] **Step 4: Update lock checker path**

Search:

```bash
git grep -n "release" -- scripts/check_dist_locks.mjs
```

Change root release path construction from:

```js
resolve(cwd(), 'release')
```

or equivalent to:

```js
resolve(cwd(), 'build/release')
```

Preserve existing process-lock behavior.

- [ ] **Step 5: Update restart script path**

Search:

```bash
git grep -n "release\|win-unpacked\|OmniPot" -- scripts/restart_dist_app.mjs
```

Change unpacked exe paths from:

```txt
release/win-unpacked/OmniPot.exe
```

to:

```txt
build/release/win-unpacked/OmniPot.exe
```

Change installer/portable lookup paths from root `release/` to `build/release/`.

- [ ] **Step 6: Search and update remaining script/config references**

Run:

```bash
git grep -n "release/\|release\\\\\|resolve(cwd(), 'release')\|resolve(process.cwd(), 'release')"
```

For non-archive config/script/test hits, update to `build/release/`.

Do not change Git remote named `release` or GitHub release terminology.

- [ ] **Step 7: Verify directory package output**

Run:

```bash
npm run dist:dir
```

Expected:

```txt
Command exits 0.
build/release/win-unpacked/OmniPot.exe exists.
No root release/ directory is required for the new output.
```

---

## Task 3: Move Playwright reports/results into `build/reports/`

**Files:**
- Modify: `playwright.config.ts`
- Modify: `.gitignore`
- Modify: `eslint_config.mjs`

- [ ] **Step 1: Update Playwright HTML report output**

In `playwright.config.ts`, change reporter from:

```ts
reporter: [['html', { open: 'never' }], ['list']],
```

to:

```ts
reporter: [['html', { open: 'never', outputFolder: './build/reports/playwright' }], ['list']],
```

- [ ] **Step 2: Update Playwright artifact output directory**

In `playwright.config.ts`, change:

```ts
outputDir: './tests/e2e/test-results',
```

to:

```ts
outputDir: './build/reports/e2e-results',
```

- [ ] **Step 3: Update gitignore generated paths**

In `.gitignore`, replace:

```txt
playwright-report/
tests/e2e/test-results/
```

with:

```txt
build/
```

If `.gitignore` already ignores `build/`, keep one entry only.

- [ ] **Step 4: Update ESLint ignores**

In `eslint_config.mjs`, replace ignore entries:

```js
'out/**',
'release/**',
'playwright-report/**',
'tests/e2e/test-results/**',
```

with:

```js
'build/**',
```

Keep unrelated ignores unchanged.

- [ ] **Step 5: Verify report path by running a targeted e2e command**

Run:

```bash
npm run test:e2e:core
```

Expected:

```txt
Command exits 0, or fails only on a real test assertion that must be fixed before completion.
build/reports/playwright/index.html exists after the run.
build/reports/e2e-results/ is used for Playwright artifacts.
```

---

## Task 4: Move dictionary resources from `resources/data/dict/` to `data/dict/`

**Files:**
- Move: `resources/data/dict/*` → `data/dict/*`
- Modify: `package.json`
- Modify: `scripts/build_chinese_dictionary.ts`
- Modify: any source/script/test references found by grep

- [ ] **Step 1: Move tracked dictionary resource files**

Use git-aware moves for tracked files:

```bash
git mv resources/data/dict data/dict
```

If `data/dict` already exists, move individual files instead:

```bash
git mv resources/data/dict/* data/dict/
```

If `resources/` becomes empty and tracked, remove the empty directory from the working tree. Git does not track empty directories.

- [ ] **Step 2: Update electron-builder extraResources dictionary source**

In `package.json`, change:

```json
{
  "from": "resources/data/dict/",
  "to": "data/dict/",
  "filter": [
    "chinese_dictionary.db",
    "chinese-dictionary-LICENSE",
    "cc_cedict.db"
  ]
}
```

to:

```json
{
  "from": "data/dict/",
  "to": "data/dict/",
  "filter": [
    "chinese_dictionary.db",
    "chinese-dictionary-LICENSE",
    "cc_cedict.db"
  ]
}
```

- [ ] **Step 3: Update dictionary build script paths**

Search:

```bash
git grep -n "resources/data/dict\|resources\\\\data\\\\dict" -- scripts/build_chinese_dictionary.ts
```

Replace every output/reference path with:

```txt
data/dict
```

or Windows escaped equivalent:

```txt
data\\dict
```

Do not change WSL upstream source path.

- [ ] **Step 4: Update runtime/test dictionary references**

Run:

```bash
git grep -n "resources/data/dict\|resources\\\\data\\\\dict"
```

For non-archive source/script/test/docs hits, replace with `data/dict`.

- [ ] **Step 5: Rebuild dictionary database**

Run:

```bash
npm run build:chinese-dictionary
```

Expected:

```txt
Command exits 0.
data/dict/chinese_dictionary.db exists or is regenerated.
No script writes to resources/data/dict/.
```

---

## Task 5: Archive non-authoritative docs and create runtime docs folder

**Files:**
- Move: `docs/review.md` → `docs/archive/reviews/review.md`
- Move: `docs/spec_code.md` → `docs/archive/reviews/spec_code.md`
- Move: `docs/spec_demo.md` → `docs/archive/reviews/spec_demo.md`
- Move: `docs/refactor_directory_structure.md` → `docs/archive/plan_archives/refactor_directory_structure.md`
- Move: `docs/better_sqlite3_abi.md` → `docs/runtime/better_sqlite3_abi.md`

- [ ] **Step 1: Move review docs**

Run:

```bash
git mv docs/review.md docs/archive/reviews/review.md
git mv docs/spec_code.md docs/archive/reviews/spec_code.md
git mv docs/spec_demo.md docs/archive/reviews/spec_demo.md
```

Expected:

```txt
Files now live under docs/archive/reviews/.
```

- [ ] **Step 2: Move directory refactor plan into plan archives**

Run:

```bash
git mv docs/refactor_directory_structure.md docs/archive/plan_archives/refactor_directory_structure.md
```

Expected:

```txt
The old one-off refactor plan is archived.
```

- [ ] **Step 3: Move ABI doc into runtime docs**

If `docs/runtime/` does not exist, create it by moving into the new path:

```bash
mkdir -p docs/runtime
git mv docs/better_sqlite3_abi.md docs/runtime/better_sqlite3_abi.md
```

Expected:

```txt
docs/runtime/better_sqlite3_abi.md exists.
```

- [ ] **Step 4: Update references to moved docs**

Run:

```bash
git grep -n "docs/review.md\|docs/spec_code.md\|docs/spec_demo.md\|docs/refactor_directory_structure.md\|docs/better_sqlite3_abi.md"
```

Replace with new paths:

```txt
docs/archive/reviews/review.md
docs/archive/reviews/spec_code.md
docs/archive/reviews/spec_demo.md
docs/archive/plan_archives/refactor_directory_structure.md
docs/runtime/better_sqlite3_abi.md
```

---

## Task 6: Update active docs and project instructions

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/test.md`
- Modify: `docs/test_e2e.md`
- Modify: `docs/release.md`
- Modify: `docs/code_quality_checks_plan.md`
- Modify: any active docs found by grep

- [ ] **Step 1: Update `CLAUDE.md` directory table**

Change entries:

```txt
resources/ | 应用图标（icon.png, icon.ico）
out/ | 构建输出
release/ | 打包输出
```

to:

```txt
public/ | 静态资源（logo 等）
data/ | 词典数据、Tesseract 训练数据
build/app/ | 编译后的 Electron/Vite 应用产物（gitignored）
build/release/ | 打包输出、安装包、便携版、latest.json（gitignored）
build/reports/ | Playwright HTML 报告与 e2e artifacts（gitignored）
```

Remove `resources/` from the active directory table if the directory no longer exists.

- [ ] **Step 2: Update `CLAUDE.md` command descriptions**

Where text says `release/` output, replace with:

```txt
build/release/
```

Where text says `out/` output, replace with:

```txt
build/app/
```

Where dictionary path says `resources/data/dict`, replace with:

```txt
data/dict
```

- [ ] **Step 3: Update release docs**

In `docs/release.md`, replace local artifact path references:

```txt
release/
```

with:

```txt
build/release/
```

Do not rename GitHub Release concepts or the Git remote named `release`.

- [ ] **Step 4: Update e2e docs**

In `docs/test_e2e.md`, replace:

```txt
out/main/index.js
out/
playwright-report/
tests/e2e/test-results/
```

with:

```txt
build/app/main/index.js
build/app/
build/reports/playwright/
build/reports/e2e-results/
```

- [ ] **Step 5: Update test docs**

In `docs/test.md`, replace packaged artifact references:

```txt
release/OmniPot{VERSION}.exe
release/OmniPot{VERSION}-portable.exe
```

with:

```txt
build/release/OmniPot{VERSION}.exe
build/release/OmniPot{VERSION}-portable.exe
```

- [ ] **Step 6: Update quality plan docs**

In `docs/code_quality_checks_plan.md`, replace build/package/report path references with:

```txt
build/app/
build/release/
build/reports/playwright/
build/reports/e2e-results/
```

Keep CI/release terminology unchanged.

- [ ] **Step 7: Search active docs for stale paths**

Run:

```bash
git grep -n "out/\|out/main/index.js\|release/\|playwright-report\|tests/e2e/test-results\|resources/data/dict" -- docs CLAUDE.md README.md TASKS.md
```

For active docs, update stale paths. For `docs/archive/**`, only update if the archived doc is being used as current guidance or contains a misleading non-historical instruction.

---

## Task 7: Clean generated leftovers and old ignored folders

**Files:**
- Remove generated folders from working tree if present and ignored:
  - `out/`
  - `release/`
  - `playwright-report/`
  - `tests/e2e/test-results/`
  - `resources/` if empty/untracked

- [ ] **Step 1: Confirm old paths are not tracked**

Run:

```bash
git ls-files out release playwright-report tests/e2e/test-results resources
```

Expected:

```txt
No tracked generated files under out/, release/, playwright-report/, or tests/e2e/test-results/.
Dictionary files under resources/ should have been moved to data/dict/ in Task 4.
```

- [ ] **Step 2: Remove ignored old generated directories**

Only after Step 1 confirms no tracked files need preserving, remove ignored leftovers:

```bash
rm -rf out release playwright-report tests/e2e/test-results
```

If `resources/` exists and is empty, remove it:

```bash
rmdir resources 2>/dev/null || true
```

- [ ] **Step 3: Verify git status has only intended tracked changes**

Run:

```bash
git status --short
```

Expected:

```txt
Moved docs/resources paths and modified config/scripts/docs are visible.
No generated build/ files are staged or tracked.
```

---

## Task 8: Full validation loop

**Files:**
- No planned edits unless validation exposes stale paths or broken config.

- [ ] **Step 1: Typecheck**

Run:

```bash
npm run typecheck
```

Expected:

```txt
Command exits 0.
```

- [ ] **Step 2: Lint**

Run:

```bash
npm run lint
```

Expected:

```txt
Command exits 0.
No lint traversal into build/.
```

- [ ] **Step 3: Unit tests**

Run:

```bash
npm test
```

Expected:

```txt
Command exits 0.
```

- [ ] **Step 4: E2E tests**

Run:

```bash
npm run test:e2e
```

Expected:

```txt
Command exits 0.
build/app/ is used for the Electron app.
build/reports/ contains Playwright report/artifacts.
```

If failures occur, fix them. Do not classify them as unrelated without evidence.

- [ ] **Step 5: Directory package smoke**

Run:

```bash
npm run dist:dir
```

Expected:

```txt
Command exits 0.
build/release/win-unpacked/OmniPot.exe exists.
The restart script launches the unpacked app if configured to do so.
```

- [ ] **Step 6: Full package build**

Run:

```bash
npm run dist
```

Expected:

```txt
Command exits 0.
build/release/OmniPot1.0.0.exe exists.
build/release/OmniPot1.0.0-portable.exe exists.
```

Use the actual version from `package.json` if it changes.

- [ ] **Step 7: Stale path grep**

Run:

```bash
git grep -n "out/\|out/main/index.js\|release/\|playwright-report\|tests/e2e/test-results\|resources/data/dict"
```

Expected:

```txt
No active config/script/source/test/doc references use old paths.
Archive-only historical mentions are acceptable if clearly historical.
```

- [ ] **Step 8: Final git status review**

Run:

```bash
git status --short
```

Expected:

```txt
Only intended tracked source/config/script/doc moves and edits are listed.
build/ is ignored.
No generated exe/report/db artifacts are staged unless they were already tracked and intentionally moved.
```

---

## Self-Review

**Spec coverage:**
- Generated artifacts move into `build/`: covered by Tasks 1, 2, 3, 7, 8.
- Docs archival: covered by Task 5 and Task 6.
- `resources/data/dict` merge into `data/dict`: covered by Task 4 and docs updates in Task 6.
- Preserve `public/`: no task changes `public/`; package icon and extraResources logo paths stay unchanged.
- Preserve root tool config files: configs are modified in place, not moved.
- Full validation: covered by Task 8.

**Placeholder scan:**
- No TBD/TODO placeholders.
- Every task has exact paths and commands.
- Where grep discovers additional references, the replacement rule is explicit.

**Type/path consistency:**
- `build/app/` consistently replaces `out/`.
- `build/release/` consistently replaces root `release/` artifact path.
- `build/reports/playwright/` and `build/reports/e2e-results/` consistently replace Playwright defaults.
- `data/dict/` consistently replaces `resources/data/dict/`.
