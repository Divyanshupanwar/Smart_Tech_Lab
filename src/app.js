require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRouter = require('./routes/userAuth');
const problemRouter = require('./routes/problemCreator');
const submitRouter = require('./routes/submit');
const aiRouter = require('./routes/aiChatting');
const videoRouter = require('./routes/videoCreator');
const assignmentRouter = require('./routes/assignment');

const buildAllowedOrigins = () => {
    const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
    const renderOrigin = process.env.RENDER_EXTERNAL_URL || null;

    return [
        process.env.FRONTEND_ORIGIN,
        renderOrigin,
        vercelOrigin,
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ].filter(Boolean);
};

const createApp = ({ apiPrefix = '' } = {}) => {
    const app = express();
    const allowedOrigins = buildAllowedOrigins();
    const frontendDistPath = path.resolve(__dirname, '../Frontend/frontend/dist');
    const hasBuiltFrontend = fs.existsSync(frontendDistPath);

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true
    }));

    app.use(express.json());
    app.use(cookieParser());

    app.use(`${apiPrefix}/user`, authRouter);
    app.use(`${apiPrefix}/problem`, problemRouter);
    app.use(`${apiPrefix}/submission`, submitRouter);
    app.use(`${apiPrefix}/ai`, aiRouter);
    app.use(`${apiPrefix}/video`, videoRouter);
    app.use(`${apiPrefix}/assignment`, assignmentRouter);

    app.get(`${apiPrefix}/health`, (_req, res) => {
        res.status(200).json({ ok: true });
    });

    if (hasBuiltFrontend) {
        app.use(express.static(frontendDistPath));

        app.get(/^(?!.*\/api(?:\/|$)).*/, (_req, res) => {
            res.sendFile(path.join(frontendDistPath, 'index.html'));
        });
    }

    return app;
};

module.exports = createApp;
