const createApp = require('../src/app');
const { ensureAppReady } = require('../src/bootstrap');

const app = createApp({ apiPrefix: '/api' });

module.exports = async (req, res) => {
    await ensureAppReady();

    const rawPath = req.query.path;
    const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath || '');
    const query = new URLSearchParams();

    Object.entries(req.query || {}).forEach(([key, value]) => {
        if (key === 'path') {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((entry) => query.append(key, entry));
            return;
        }

        if (value !== undefined) {
            query.set(key, value);
        }
    });

    req.url = `/api/${path}${query.toString() ? `?${query.toString()}` : ''}`;
    return app(req, res);
};
