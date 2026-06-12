import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const r2_base_url = 'https://downloads.zzzkkkccc.site/omni-pot'
const github_base_url = 'https://github.com/TuTouPower/omni_pot_release/releases/download'

const FILE_SPECS = [
    { os: 'windows', type: 'setup', ext: 'exe' },
    { os: 'windows', type: 'portable', ext: 'exe' },
    { os: 'macos', type: 'dmg', ext: 'dmg' },
    { os: 'linux', type: 'appimage', ext: 'AppImage' },
]

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

function make_filename(version, os, type, ext) {
    return `OmniPot-${version}-${os}-${type}.${ext}`
}

async function find_release_file(release_dir, version, spec) {
    const expected = make_filename(version, spec.os, spec.type, spec.ext)
    const entries = await readdir(release_dir)

    const match = entries.find((name) => name.toLowerCase() === expected.toLowerCase())
    if (!match) {
        throw new Error(`Release file not found: ${expected} in ${release_dir}`)
    }

    return join(release_dir, match)
}

async function build_file_metadata({ path, version, os, type, filename }) {
    const info = await stat(path)
    const file_sha256 = await sha256_file(path)

    return {
        os,
        type,
        filename,
        source_path: path,
        sha256: file_sha256,
        size: info.size,
        github_url: `${github_base_url}/v${version}/${filename}`,
        r2_url: `${r2_base_url}/latest/${filename}`,
        r2_version_key: `omni-pot/${version}/${filename}`,
        r2_latest_key: `omni-pot/latest/${filename}`,
    }
}

function to_cst_iso(date) {
    const cst = new Date(date.getTime() + 8 * 3600000)
    return cst.toISOString().replace('Z', '+08:00')
}

export async function build_latest_metadata({ version, release_dir = 'build/release', released_at = new Date() }) {
    const files = []

    for (const spec of FILE_SPECS) {
        try {
            const path = await find_release_file(release_dir, version, spec)
            const filename = make_filename(version, spec.os, spec.type, spec.ext)
            files.push(await build_file_metadata({ path, version, os: spec.os, type: spec.type, filename }))
        } catch {
            // skip platforms not built for this release
        }
    }

    if (files.length === 0) {
        throw new Error(`No release files found in ${release_dir}`)
    }

    return {
        format_version: 2,
        version,
        released_at: to_cst_iso(released_at),
        files,
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
        files: metadata.files.map((file) => ({
            os: file.os,
            type: file.type,
            filename: file.filename,
            sha256: file.sha256,
            size: file.size,
            github_url: file.github_url,
            r2_url: file.r2_url,
        })),
    }
}
