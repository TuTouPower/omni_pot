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

        stream.on('data', (chunk) => {
            hash.update(chunk)
        })
        stream.on('error', reject)
        stream.on('end', () => {
            resolve(hash.digest('hex'))
        })
    })
}

function escape_regexp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function find_release_file(release_dir, version, kind) {
    const entries = await readdir(release_dir)
    const escaped_version = escape_regexp(version)
    const pattern = kind === 'portable'
        ? new RegExp(`^OmniPot${escaped_version}-portable\\.exe$`, 'i')
        : new RegExp(`^OmniPot${escaped_version}\\.exe$`, 'i')
    const matches = entries.filter((name) => pattern.test(name))

    if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${kind} release file for version ${version}, found ${String(matches.length)}`)
    }

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

function to_cst_iso(date) {
    const cst = new Date(date.getTime() + 8 * 3600000)
    return cst.toISOString().replace('Z', '+08:00')
}

export async function build_latest_metadata({ version, release_dir = 'build/release', released_at = new Date() }) {
    const installer_path = await find_release_file(release_dir, version, 'installer')
    const portable_path = await find_release_file(release_dir, version, 'portable')

    return {
        format_version: 1,
        version,
        released_at: to_cst_iso(released_at),
        files: {
            windows_installer: await build_file_metadata({
                path: installer_path,
                version,
                filename: `OmniPot${version}.exe`,
                versioned_filename: `OmniPot${version}.exe`,
            }),
            windows_portable: await build_file_metadata({
                path: portable_path,
                version,
                filename: `OmniPot${version}-portable.exe`,
                versioned_filename: `OmniPot${version}-portable.exe`,
            }),
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
        files: Object.fromEntries(
            Object.entries(metadata.files).map(([key, file]) => [
                key,
                {
                    filename: file.filename,
                    versioned_filename: file.versioned_filename,
                    sha256: file.sha256,
                    size: file.size,
                    github_url: file.github_url,
                    r2_url: file.r2_url,
                },
            ]),
        ),
    }
}
