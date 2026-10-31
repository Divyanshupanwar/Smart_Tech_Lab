require('./config/loadEnv');

const createApp = require('./app');
const { ensureAppReady } = require('./bootstrap');
const { processExpiredAttempts } = require('./controllers/labExam');
const { processBattles } = require('./controllers/battle');
const { initializeBattleSockets } = require('./services/battleRealtime');
const { initializeExamSockets } = require('./services/examRealtime');
const http = require('http');

const apiPrefix = process.env.NODE_ENV === 'production' ? '/api' : '';
const port = Number(process.env.PORT) || 3000;
const app = createApp({ apiPrefix });
const server = http.createServer(app);
const initializeConnection = async () => {
    try {
        await ensureAppReady();
        console.log('DB Connected');
        const io = await initializeBattleSockets(server);
        initializeExamSockets(io);

        const expiryTimer = setInterval(processExpiredAttempts, 15000);
        const battleTimer = setInterval(processBattles, 2000);
        expiryTimer.unref();
        battleTimer.unref();

        server.listen(port, () => {
            console.log('Server listening at port number: ' + port);
        });
    }
    catch (err) {
        console.log('Error: ' + err);
    }
};

initializeConnection();
