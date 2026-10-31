const resolveJudge0Config = (env = process.env) => {
    const apiUrl = String(env.JUDGE0_API_URL || '').trim().replace(/\/+$/, '');
    const apiKey = String(env.JUDGE0_API_KEY || env.RAPIDAPI_KEY || '').trim();

    if (apiUrl) {
        let parsedUrl;
        try {
            parsedUrl = new URL(apiUrl);
        } catch (_error) {
            throw new Error('JUDGE0_API_URL must be a valid http or https URL.');
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('JUDGE0_API_URL must use http or https.');
        }
        const authToken = String(env.JUDGE0_AUTH_TOKEN || '').trim();
        const authHeader = String(env.JUDGE0_AUTH_HEADER || '').trim() || 'X-Auth-Token';
        return {
            baseUrl: apiUrl,
            headers: authToken ? { [authHeader]: authToken } : {},
            provider: 'self-hosted'
        };
    }

    if (!apiKey) {
        throw new Error('Judge0 is not configured. Add JUDGE0_API_KEY to the project root .env, or set JUDGE0_API_URL to a reachable self-hosted Judge0 server.');
    }

    const host = String(env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com').trim();
    if (!host || /[\s/]/.test(host)) throw new Error('JUDGE0_API_HOST must be a hostname without a scheme or path.');
    return {
        baseUrl: `https://${host}`,
        headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': host },
        provider: 'rapidapi'
    };
};

module.exports = { resolveJudge0Config };
