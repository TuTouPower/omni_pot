import { spawn } from 'child_process'
import { resolve } from 'path'

const PROJECT_ROOT = resolve(__dirname, '../..')

async function run(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const build = spawn('npx', ['electron-vite', 'build', '--outDir', 'out'], {
            cwd: PROJECT_ROOT,
            shell: true,
            stdio: 'inherit',
            env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
        })
        build.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Build failed with code ${code}`))
        })
    })
}

export default run
