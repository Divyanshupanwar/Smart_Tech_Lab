require('dotenv').config();

const createApp = require('./app');
const { ensureAppReady } = require('./bootstrap');

const apiPrefix = process.env.NODE_ENV === 'production' ? '/api' : '';
const port = Number(process.env.PORT) || 3000;
const app = createApp({ apiPrefix });

const initializeConnection = async () => {
    try {
        await ensureAppReady();
        console.log('DB Connected');

        app.listen(port, () => {
            console.log('Server listening at port number: ' + port);
        });
    }
    catch (err) {
        console.log('Error: ' + err);
    }
};

initializeConnection();
