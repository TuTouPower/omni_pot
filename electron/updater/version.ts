export function compare_versions(current: string, latest: string): boolean {
    const parse_version = (v: string) => {
        const cleaned = v.replace(/^v/, '')
        const [version = '0', ...pre_parts] = cleaned.split('-')
        const parts = version.split('.').map(Number)
        const major = parts[0] ?? 0
        const minor = parts[1] ?? 0
        const patch = parts[2] ?? 0
        const pre_release = pre_parts.length > 0 ? pre_parts.join('-') : null
        return { major, minor, patch, pre_release }
    }

    const cur = parse_version(current)
    const lat = parse_version(latest)

    if (lat.major !== cur.major) return lat.major > cur.major
    if (lat.minor !== cur.minor) return lat.minor > cur.minor
    if (lat.patch !== cur.patch) return lat.patch > cur.patch

    if (cur.pre_release && !lat.pre_release) return true
    if (!cur.pre_release && lat.pre_release) return false
    if (cur.pre_release && lat.pre_release) {
        const cur_parts = cur.pre_release.split('.').map((p) => { const n = Number(p); return Number.isNaN(n) ? p : n })
        const lat_parts = lat.pre_release.split('.').map((p) => { const n = Number(p); return Number.isNaN(n) ? p : n })
        for (let i = 0; i < Math.max(cur_parts.length, lat_parts.length); i++) {
            const c = cur_parts[i] ?? 0
            const l = lat_parts[i] ?? 0
            if (typeof c === 'number' && typeof l === 'number') {
                if (l !== c) return l > c
            } else {
                const cs = String(c)
                const ls = String(l)
                if (ls !== cs) return ls > cs
            }
        }
        return false
    }

    return false
}
