export function buildCsrfHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (typeof document === 'undefined') {
        return headers;
    }

    const metaToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
    if (metaToken) {
        headers['X-CSRF-TOKEN'] = metaToken;
    }

    const xsrfMatch = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (xsrfMatch?.[1]) {
        headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);
    }

    return headers;
}
