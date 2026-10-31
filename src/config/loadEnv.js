const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const loadEnv = () => {
    const envPaths = [
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../.env')
    ];

    for (const envPath of envPaths) {
        if (!fs.existsSync(envPath)) continue;
        const values = dotenv.parse(fs.readFileSync(envPath));
        for (const [key, value] of Object.entries(values)) {
            if (!String(process.env[key] || '').trim() && String(value).trim()) process.env[key] = value;
        }
    }
};

loadEnv();

module.exports = loadEnv;
