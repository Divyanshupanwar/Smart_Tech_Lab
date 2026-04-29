const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const normalizeOrigin = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    return trimTrailingSlash(value.trim());
};

const getFrontendOrigin = (requestOrigin) => {
    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
    if (normalizedRequestOrigin) {
        return normalizedRequestOrigin;
    }

    if (process.env.FRONTEND_ORIGIN) {
        return normalizeOrigin(process.env.FRONTEND_ORIGIN);
    }

    if (process.env.VERCEL_URL) {
        return `https://${normalizeOrigin(process.env.VERCEL_URL)}`;
    }

    return 'http://localhost:5173';
};

const buildResetPasswordUrl = (token, requestOrigin) => `${getFrontendOrigin(requestOrigin)}/reset-password/${token}`;

module.exports = {
    buildResetPasswordUrl,
    getFrontendOrigin
};
