import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { cwd, exit, platform } from 'node:process'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { build_latest_metadata, public_metadata, write_latest_json } from './release_metadata.mjs'

const source_repo = 'TuTouPower/omni_pot'
const github_latest_json_url = (tag) => `https://github.com/${source_repo}/releases/download/${tag}/latest.json`
const r2_latest_json_url = 'https://downloads.zzzkkkccc.site/omni-pot/latest.json'
const wsl_cloudflare_service_dir = '/home/karon/karson_ubuntu/cloudflare_service'

function to_wsl_path(path) {
    const match = /^([A-Za-z]):[\\/](.*)$/.exec(path)
    if (!match) return path

    return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll('\\', '/')}`
}

function r2_args(args) {
    if (platform !== 'win32') return args

    return args.map((arg, index) => (args[index - 1] === '--file' ? to_wsl_path(arg) : arg))
}

export function build_r2_command(args) {
    if (platform === 'win32') {
        return { command: 'wsl.exe', args: ['--cd', wsl_cloudflare_service_dir, 'npx', 'wrangler', ...r2_args(args)] }
    }

    return { command: 'npx', args: ['wrangler', ...args] }
}

function format_r2_command(args) {
    const r2_command = build_r2_command(args)

    return format_command(r2_command.command, r2_command.args)
}

export function spawn_command(command) {
    return command
}

export function spawn_shell(command) {
    return platform === 'win32' && (command === 'npm' || command === 'npx')
}

function parse_args(argv) {
    const options = {
        version: '',
        skip_dist: false,
        dry_run: false,
    }

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]

        if (arg === '--version') {
            options.version = argv[index + 1] ?? ''
            index += 1
        } else if (arg === '--skip-dist') {
            options.skip_dist = true
        } else if (arg === '--dry-run') {
            options.dry_run = true
        } else {
            throw new Error(`Unknown argument: ${arg}`)
        }
    }

    return options
}

async function package_version() {
    const package_json = JSON.parse(await readFile(resolve(cwd(), 'package.json'), 'utf8'))
    if (typeof package_json.version !== 'string' || package_json.version.length === 0) throw new Error('Missing package.json version')
    return package_json.version
}

function quote_arg(value) {
    if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value

    return `'${value.replaceAll("'", "'\\''")}'`
}

function format_command(command, args) {
    return [command, ...args].map(quote_arg).join(' ')
}

function run(command, args, { dry_run = false, stdio = 'inherit', allow_failure = false } = {}) {
    const display = format_command(command, args)

    if (dry_run) {
        console.log(display)
        return { status: 0, stdout: '', stderr: '' }
    }

    const result = spawnSync(spawn_command(command), args, {
        cwd: cwd(),
        encoding: 'utf8',
        shell: spawn_shell(command),
        stdio,
    })

    if (result.error) {
        throw result.error
    }

    if (!allow_failure && result.status !== 0) {
        throw new Error(`Command failed (${String(result.status)}): ${display}`)
    }

    return result
}

function sha256_file(path) {
    return new Promise((resolve_hash, reject) => {
        const hash = createHash('sha256')
        const stream = createReadStream(path)

        stream.on('data', (chunk) => {
            hash.update(chunk)
        })
        stream.on('error', reject)
        stream.on('end', () => {
            resolve_hash(hash.digest('hex'))
        })
    })
}

async function local_file_metadata(path) {
    const info = await stat(path)

    return {
        sha256: await sha256_file(path),
        size: info.size,
    }
}

function assert_file_metadata(name, actual, expected) {
    if (actual.size !== expected.size || actual.sha256 !== expected.sha256) {
        throw new Error(`${name} does not match local metadata`)
    }
}

async function fetch_json(url) {
    const response = await fetch(url, { cache: 'no-store' })

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }

    return response.json()
}

async function fetch_optional_json(url) {
    const response = await fetch(url, { cache: 'no-store' })

    if (response.status === 404) return null
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }

    return response.json()
}

function r2_latest_key_from_url(url) {
    try {
        const parsed_url = new URL(url)
        if (parsed_url.hostname !== 'downloads.zzzkkkccc.site') return null
        const key = parsed_url.pathname.replace(/^\//, '')
        if (!key.startsWith('omni-pot/latest/')) return null
        return key
    } catch {
        return null
    }
}

function metadata_files(metadata) {
    const files = metadata?.files ?? []
    return Array.isArray(files) ? files : Object.values(files)
}

export function collect_stale_r2_latest_keys(previous_metadata, current_files) {
    const current_keys = new Set(current_files.map((file) => file.r2_latest_key))
    const previous_keys = metadata_files(previous_metadata)
        .map((file) => r2_latest_key_from_url(file?.r2_url))
        .filter((key) => key && !current_keys.has(key))

    return [...new Set(previous_keys)]
}

async function delete_stale_r2_latest_objects(previous_metadata, files, options) {
    if (options.dry_run) {
        console.log('# fetch current R2 latest.json and delete stale latest objects after the new release verifies')
        return
    }

    for (const key of collect_stale_r2_latest_keys(previous_metadata, files)) {
        run_r2(['r2', 'object', 'delete', `releases/${key}`, '--remote'])
    }
}

async function fetch_binary_metadata(url) {
    const response = await fetch(url, { cache: 'no-store' })

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())

    return {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        size: bytes.byteLength,
    }
}

function assert_same_json(name, actual, expected) {
    const actual_text = JSON.stringify(actual)
    const expected_text = JSON.stringify(expected)

    if (actual_text !== expected_text) {
        throw new Error(`${name} latest.json does not match local public metadata`)
    }
}

export function is_not_found_error(result) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

    return /\b404\b|not[ -]?found|no such key|nosuchkey|specified key does not exist/i.test(output)
}

function command_output(result) {
    return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
}

function get_github_assets(tag, repo) {
    const result = run('gh', ['release', 'view', tag, '--repo', repo, '--json', 'assets'], { stdio: 'pipe' })
    const release = JSON.parse(result.stdout)

    return release.assets ?? []
}

async function with_temp_dir(run_with_dir) {
    const dir = await mkdtemp(join(tmpdir(), 'omni-pot-publish-'))

    try {
        return await run_with_dir(dir)
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
}

export function matches_github_asset_metadata(asset, file) {
    return asset.size === file.size && asset.digest === `sha256:${file.sha256}`
}

async function verify_existing_github_asset(tag, file, temp_dir, repo) {
    run('gh', ['release', 'download', tag, '--repo', repo, '--pattern', file.filename, '--dir', temp_dir])
    const downloaded_path = join(temp_dir, file.filename)
    const actual = await local_file_metadata(downloaded_path)

    assert_file_metadata(`GitHub asset ${file.filename}`, actual, file)
}

async function upload_github_version_assets(tag, files, options, repo) {
    if (options.dry_run) {
        for (const file of files) {
            console.log(`# [${repo}] if GitHub asset ${file.filename} exists, download and verify sha256/size; otherwise upload without --clobber`)
            console.log(format_command('gh', ['release', 'view', tag, '--repo', repo, '--json', 'assets']))
            console.log(format_command('gh', ['release', 'download', tag, '--repo', repo, '--pattern', file.filename, '--dir', '<temp-dir>']))
            console.log(format_command('gh', ['release', 'upload', tag, file.source_path, '--repo', repo]))
        }
        return
    }

    const assets = get_github_assets(tag, repo)
    await with_temp_dir(async (temp_dir) => {
        for (const file of files) {
            const existing_asset = assets.find((asset) => asset.name === file.filename)

            if (existing_asset) {
                if (matches_github_asset_metadata(existing_asset, file)) continue
                if (existing_asset.size !== file.size) {
                    throw new Error(`[${repo}] GitHub asset ${file.filename} exists with different size`)
                }
                await verify_existing_github_asset(tag, file, temp_dir, repo)
            } else {
                run('gh', ['release', 'upload', tag, file.source_path, '--repo', repo])
            }
        }
    })
}

function run_r2(args, options) {
    const { command, args: r2_args } = build_r2_command(args)

    return run(command, r2_args, options)
}

async function upload_r2_version_archive(file, options) {
    const object_key = `releases/${file.r2_version_key}`

    if (options.dry_run) {
        console.log(`# if R2 object ${object_key} exists, download and verify sha256/size; otherwise upload`)
        console.log(format_r2_command(['r2', 'object', 'get', object_key, '--file', '<temp-file>', '--remote']))
        console.log(format_r2_command(['r2', 'object', 'put', object_key, '--file', file.source_path, '--remote']))
        return
    }

    await with_temp_dir(async (temp_dir) => {
        const downloaded_path = join(temp_dir, basename(file.r2_version_key))
        const get_result = run_r2(['r2', 'object', 'get', object_key, '--file', downloaded_path, '--remote'], {
            stdio: 'pipe',
            allow_failure: true,
        })

        if (get_result.status === 0) {
            const actual = await local_file_metadata(downloaded_path)
            assert_file_metadata(`R2 object ${object_key}`, actual, file)
        } else if (is_not_found_error(get_result)) {
            run_r2(['r2', 'object', 'put', object_key, '--file', file.source_path, '--remote'])
        } else {
            const output = command_output(get_result)
            throw new Error(`Failed to check R2 object ${object_key}; refusing to overwrite version archive${output ? `: ${output}` : ''}`)
        }
    })
}

async function ensure_github_release(tag, repo, version, options) {
    if (options.dry_run) {
        console.log(`# [${repo}] ensure release exists`)
        console.log(format_command('gh', ['release', 'view', tag, '--repo', repo]))
        console.log(format_command('gh', ['release', 'create', tag, '--repo', repo, '--title', `Omni Pot ${version}`, '--notes', `Omni Pot ${version}`]))
        return
    }

    const view_result = run('gh', ['release', 'view', tag, '--repo', repo], {
        stdio: 'ignore',
        allow_failure: true,
    })

    if (view_result.status !== 0) {
        run('gh', ['release', 'create', tag, '--repo', repo, '--title', `Omni Pot ${version}`, '--notes', `Omni Pot ${version}`])
    }
}

async function main() {
    const options = parse_args(process.argv.slice(2))
    const version = await package_version()
    if (options.version && options.version !== version) throw new Error(`--version ${options.version} does not match package.json version ${version}`)
    const tag = `v${version}`
    const release_dir = resolve(cwd(), 'build/release')
    const github_repos = [source_repo]

    if (!options.skip_dist) {
        run('npm', ['run', 'dist'], { dry_run: options.dry_run })
    }

    const metadata = await build_latest_metadata({ version, release_dir })
    const public_json = public_metadata(metadata)
    const latest_json_path = join(release_dir, 'latest.json')
    const release_files = metadata.files

    if (!options.dry_run) {
        await write_latest_json(release_dir, public_json)
    }

    for (const repo of github_repos) {
        await ensure_github_release(tag, repo, version, options)
        await upload_github_version_assets(tag, release_files, options, repo)
    }

    for (const file of release_files) {
        await upload_r2_version_archive(file, options)
    }
    const previous_r2_latest_metadata = options.dry_run ? null : await fetch_optional_json(r2_latest_json_url)
    for (const file of release_files) {
        run_r2(['r2', 'object', 'put', `releases/${file.r2_latest_key}`, '--file', file.source_path, '--remote'], { dry_run: options.dry_run })
    }

    if (options.dry_run) {
        console.log(`# would write ${latest_json_path}`)
        console.log(JSON.stringify(public_json, null, 4))
        for (const file of release_files) {
            console.log(`# fetch ${file.r2_url} and verify sha256/size`)
        }
        for (const repo of github_repos) {
            console.log(format_command('gh', ['release', 'upload', tag, latest_json_path, '--repo', repo, '--clobber']))
        }
        console.log(format_r2_command(['r2', 'object', 'put', 'releases/omni-pot/latest.json', '--file', latest_json_path, '--remote']))
        console.log(`# fetch ${github_latest_json_url(tag)}`)
        console.log(`# fetch ${r2_latest_json_url}`)
        await delete_stale_r2_latest_objects(previous_r2_latest_metadata, release_files, options)
        return
    }

    for (const file of release_files) {
        const actual = await fetch_binary_metadata(file.r2_url)
        assert_file_metadata(`R2 latest file ${file.r2_url}`, actual, file)
    }

    for (const repo of github_repos) {
        run('gh', ['release', 'upload', tag, latest_json_path, '--repo', repo, '--clobber'])
    }
    run_r2(['r2', 'object', 'put', 'releases/omni-pot/latest.json', '--file', latest_json_path, '--remote'])

    const local_json = JSON.parse(await readFile(latest_json_path, 'utf8'))
    const github_json = await fetch_json(github_latest_json_url(tag))
    const r2_json = await fetch_json(r2_latest_json_url)

    assert_same_json('GitHub', github_json, local_json)
    assert_same_json('R2', r2_json, local_json)

    await delete_stale_r2_latest_objects(previous_r2_latest_metadata, release_files, options)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        exit(1)
    })
}
