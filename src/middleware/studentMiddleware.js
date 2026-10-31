const userMiddleware = require('./userMiddleWare');

const studentMiddleware = (req, res, next) => userMiddleware(req, res, () => {
    if (req.result?.role !== 'user') {
        return res.status(403).json({ message: 'Student access is required for this feature.' });
    }
    return next();
});

module.exports = studentMiddleware;
