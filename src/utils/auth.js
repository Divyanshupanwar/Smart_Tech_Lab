const jwt = require('jsonwebtoken');

const isSecureCookie = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie,
    maxAge: 60 * 60 * 1000
};

const clearCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie
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
