function is_e2e_update_url(url: URL): boolean {
    return process.env['OMNI_POT_E2E'] === '1' && url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
}

function is_release_asset_url(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'github.com' && /^\/TuTouPower\/omni_pot\/releases\/download\/v[^/]+\/OmniPot-[^/]+\.(?:exe|dmg|AppImage)$/.test(url.pathname)
}

function is_release_redirect_url(url: URL): boolean {
    return url.protocol === 'https:' && (
        url.hostname === 'objects.githubusercontent.com' ||
        url.hostname.endsWith('.githubusercontent.com')
    )
}

function is_r2_update_url(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'downloads.zzzkkkccc.site' && /^\/omni-pot\/latest\/OmniPot-.+\.(?:exe|dmg|AppImage)$/.test(url.pathname)
}

export function assert_allowed_download_url(download_url: string, is_redirect: boolean): URL {
    const parsed_url = new URL(download_url)
    if (is_e2e_update_url(parsed_url)) return parsed_url
    if (is_r2_update_url(parsed_url)) return parsed_url
    if (is_redirect ? is_release_redirect_url(parsed_url) : is_release_asset_url(parsed_url)) return parsed_url
    throw new Error('Unsupported update download URL')
}
