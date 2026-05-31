import { execFile } from 'node:child_process'
import console from 'node:console'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * electron-builder afterPack hook.
 * Patches the Electron exe version info so task manager shows "Omni Pot"
 * instead of "Electron".
 */
export default async function afterPack(context) {
    if (context.electronPlatformName !== 'win32') return

    const exe_path = join(context.appOutDir, 'OmniPot.exe')
    const rcedit_path = join(context.packager.projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe')

    const version = context.packager.appInfo.version

    console.log(`[afterPack] patching exe metadata: ${exe_path}`)

    const icon_path = join(context.packager.projectDir, 'public', 'logos', 'logo.ico')

    await execFileAsync(rcedit_path, [
        exe_path,
        '--set-icon', icon_path,
        '--set-version-string', 'FileDescription', 'Omni Pot',
        '--set-version-string', 'ProductName', 'Omni Pot',
        '--set-version-string', 'CompanyName', 'TuTouPower',
        '--set-version-string', 'LegalCopyright', 'Copyright (C) 2025 TuTouPower',
        '--set-version-string', 'OriginalFilename', 'OmniPot.exe',
        '--set-product-version', version,
        '--set-file-version', version,
    ])

    console.log(`[afterPack] exe metadata patched successfully`)
}
