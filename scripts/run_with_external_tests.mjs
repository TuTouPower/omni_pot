import { spawnSync } from 'node:child_process'
import process from 'node:process'

const args = process.argv.slice(2)
const result = spawnSync(
    'npx',
    ['playwright', ...args],
    {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, OMNI_POT_EXTERNAL_SERVICE_TESTS: '1' },
    }
)
process.exit(result.status ?? 1)
