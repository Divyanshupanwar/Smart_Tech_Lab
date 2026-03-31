require('dotenv').config();

const createApp = require('./app');
const { ensureAppReady } = require('./bootstrap');

const app = createApp();

const initializeConnection = async () => {
    try {
        await ensureAppReady();
        console.log('DB Connected');

        app.listen(process.env.PORT, () => {
            console.log('Server listening at port number: ' + process.env.PORT);
        });
    }
    catch (err) {
        console.log('Error: ' + err);
    }
};

initializeConnection();
