const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';

const cookieOptions = {
    httpOnly: true,
    sameSite: isProd ? 'None' : 'lax',
    secure: isProd,
    maxAge: 60 * 60 * 1000,
    path: '/'
};

const clearCookieOptions = {
    httpOnly: true,
    sameSite: isProd ? 'None' : 'lax',
    secure: isProd,
    path: '/'
};

const serializeUser = (user) => ({
    firstName: user.firstName,
    emailID: user.emailID,
    _id: user._id,
    role: user.role
});

const buildTokenPayload = (user) => ({
    _id: user._id,
    emailID: user.emailID,
    role: user.role,
    authVersion: user.authVersion ?? 0
});

const issueAuthCookie = (res, user) => {
    const token = jwt.sign(buildTokenPayload(user), process.env.JWT_KEY, { expiresIn: '1h' });
    res.cookie('token', token, cookieOptions);
    return token;
};

module.exports = {
    buildTokenPayload,
    clearCookieOptions,
    cookieOptions,
    issueAuthCookie,
    serializeUser
};
