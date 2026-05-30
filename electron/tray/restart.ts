import { app } from 'electron'
import { spawn } from 'child_process'
import { log } from '../log'

const log_restart = log.scope('restart')

export function do_restart(): void {
    log_restart.info('spawning new process with execPath=%s, args=%j', process.execPath, process.argv.slice(1))
    try {
        const child = spawn(process.execPath, process.argv.slice(1), {
            cwd: process.cwd(),
            detached: true,
            stdio: 'ignore',
            env: process.env,
        })
        child.unref()
        log_restart.info('new process spawned (pid=%d), exiting current process', child.pid)
    } catch (err) {
        log_restart.error('spawn failed, falling back to app.relaunch(): %s', err)
        app.relaunch()
    }
    app.exit(0)
}
