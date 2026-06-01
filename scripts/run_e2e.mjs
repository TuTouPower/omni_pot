import { spawnSync } from 'node:child_process'
import process from 'node:process'

/**
 * Two-phase e2e runner.
 *
 * Phase 1: serial — core + ui-serial projects with workers=1. Includes
 *          the one-time electron-vite build via globalSetup.
 * Phase 2: parallel — ui-parallel project with workers=4. Reuses the build
 *          from phase 1 via OMNI_POT_E2E_SKIP_BUILD=1.
 *
 * Pass extra CLI args (e.g. spec filter, --headed) on the command line; they
 * are forwarded to both phases.
 *
 * Usage:
 *   node scripts/run_e2e.mjs                    # both phases, default scope
 *   node scripts/run_e2e.mjs --only=serial      # phase 1 only
 *   node scripts/run_e2e.mjs --only=parallel    # phase 2 only
 *   node scripts/run_e2e.mjs --scope=ui         # only ui-serial + ui-parallel
 *   node scripts/run_e2e.mjs --scope=core       # only core
 */

const raw_args = process.argv.slice(2)
let only = null
let scope = 'all'
const extra_args = []
for (const arg of raw_args) {
    if (arg.startsWith('--only=')) only = arg.slice('--only='.length)
    else if (arg.startsWith('--scope=')) scope = arg.slice('--scope='.length)
    else extra_args.push(arg)
}

function run_playwright(projects, workers, skip_build) {
    if (projects.length === 0) return 0
    const project_args = projects.flatMap(p => ['--project', p])
    const args = ['playwright', 'test', ...project_args, '--workers', String(workers), ...extra_args]
    const env = { ...process.env }
    if (skip_build) env.OMNI_POT_E2E_SKIP_BUILD = '1'
    process.stderr.write(`[run_e2e] npx ${args.join(' ')}${skip_build ? ' (skip build)' : ''}\n`)
    const result = spawnSync('npx', args, { stdio: 'inherit', shell: true, env })
    return result.status ?? 1
}

const serial_projects = []
const parallel_projects = []
if (scope === 'all' || scope === 'core') serial_projects.push('core')
if (scope === 'all' || scope === 'ui') {
    serial_projects.push('ui-serial')
    parallel_projects.push('ui-parallel')
}

if (only === 'serial') {
    process.exit(run_playwright(serial_projects, 1, false))
} else if (only === 'parallel') {
    process.exit(run_playwright(parallel_projects, 4, false))
} else {
    const code1 = run_playwright(serial_projects, 1, false)
    if (code1 !== 0) process.exit(code1)
    const code2 = run_playwright(parallel_projects, 4, true)
    process.exit(code2)
}
