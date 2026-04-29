const crypto = require('crypto');
const bcrypt = require('bcrypt');
const validator = require('validator');
const { OAuth2Client } = require('google-auth-library');

const redisClient = require('../config/redis');
const User = require('../models/user');
const validate = require('../utils/validator');
const { issueAuthCookie, clearCookieOptions, serializeUser } = require('../utils/auth');
const { sendEmail } = require('../utils/email');
const { buildResetPasswordUrl } = require('../utils/frontendUrl');

const googleClient = process.env.GOOGLE_CLIENT_ID
    ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    : null;

const normalizeEmail = (email) => email?.toLowerCase().trim();
const normalizeFirstName = (value) => {
    const firstName = value?.trim();
    return firstName && firstName.length >= 3 ? firstName : 'Google User';
};

const createPasswordResetToken = async (user) => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetTokenHash = hashedToken;
    user.passwordResetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await user.save({ validateBeforeSave: false });
    return rawToken;
};

const clearPasswordResetToken = async (user) => {
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpiresAt = null;
    await user.save({ validateBeforeSave: false });
};

const sendPasswordResetEmail = async (user, rawToken, requestOrigin) => {
    const resetUrl = buildResetPasswordUrl(rawToken, requestOrigin);
    const subject = 'Reset your Smart Tech Lab password';
    const text = [
        `Hi ${user.firstName},`,
        '',
        'We received a request to reset your password.',
        `Reset it here: ${resetUrl}`,
        '',
        'This link expires in 15 minutes. If you did not request this, you can ignore this email.'
    ].join('\n');
    const html = `
        <div style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.6;">
            <p>Hi ${user.firstName},</p>
            <p>We received a request to reset your password for Smart Tech Lab.</p>
            <p>
                <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#2147ba;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">
                    Reset Password
                </a>
            </p>
            <p>This link expires in 15 minutes.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
        </div>
    `;

    await sendEmail({
        to: user.emailID,
        subject,
        text,
        html
    });
};

const register = async (req, res) => {
    try {
        validate(req.body);
        const emailID = normalizeEmail(req.body.emailID);
        const { firstName, password } = req.body;

        const existingUser = await User.findOne({ emailID });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists with this email. Please login instead.' });
        }

        const user = await User.create({
            ...req.body,
            firstName: firstName.trim(),
            emailID,
            password: await bcrypt.hash(password, 10),
            role: 'user'
        });

        issueAuthCookie(res, user);
        res.status(201).json({
            user: serializeUser(user),
            message: 'Registered Successfully!'
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'User already exists with this email. Please login instead.' });
        }

        res.status(400).json({ message: err.message || String(err) });
    }
};

const login = async (req, res) => {
    try {
        const emailID = normalizeEmail(req.body.emailID);
        const { password } = req.body;

        if (!emailID) {
            throw new Error('Email is required!');
        }

        if (!password) {
            throw new Error('Password is required!');
        }

        const user = await User.findOne({ emailID });
        if (!user) {
            throw new Error('Invalid email or password!');
        }

        if (!user.password) {
            throw new Error('This account uses Google sign-in. Use Continue with Google or reset your password.');
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            throw new Error('Invalid email or password!');
        }

        issueAuthCookie(res, user);
        res.status(200).json({
            user: serializeUser(user),
            message: 'Login Successfully!'
        });
    } catch (err) {
        res.status(401).json({ message: err.message || 'Invalid credentials' });
    }
};

const googleLogin = async (req, res) => {
    try {
        if (!googleClient || !process.env.GOOGLE_CLIENT_ID) {
            return res.status(503).json({ message: 'Google sign-in is not configured.' });
        }

        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: 'Google credential is required.' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const emailID = normalizeEmail(payload?.email);

        if (!payload || !emailID || !payload.email_verified) {
            return res.status(401).json({ message: 'Google account could not be verified.' });
        }

        let user = await User.findOne({ emailID });

        if (!user) {
            const firstName = normalizeFirstName(payload.given_name || payload.name?.split(' ')[0]);
            user = await User.create({
                firstName,
                emailID,
                googleId: payload.sub,
                role: 'user'
            });
        } else if (user.googleId && user.googleId !== payload.sub) {
            return res.status(409).json({ message: 'This email is already linked to another Google account.' });
        } else if (!user.googleId) {
            user.googleId = payload.sub;
            await user.save();
        }

        issueAuthCookie(res, user);
        res.status(200).json({
            user: serializeUser(user),
            message: 'Logged in with Google successfully!'
        });
    } catch (err) {
        res.status(401).json({ message: err.message || 'Google sign-in failed.' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const emailID = normalizeEmail(req.body.emailID);

        if (!emailID || !validator.isEmail(emailID)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        const user = await User.findOne({ emailID });
        if (!user) {
            return res.status(200).json({
                message: 'If an account exists for that email, a reset link has been sent.'
            });
        }

        const rawToken = await createPasswordResetToken(user);

        try {
            await sendPasswordResetEmail(user, rawToken, req.get('origin'));
        } catch (emailError) {
            await clearPasswordResetToken(user);
            return res.status(500).json({ message: emailError.message || 'Unable to send reset email right now.' });
        }

        res.status(200).json({
            message: 'If an account exists for that email, a reset link has been sent.'
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Unable to process password reset.' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Reset token is required.' });
        }

        if (!password || !validator.isStrongPassword(password)) {
            return res.status(400).json({
                message: 'Password must be strong and include uppercase, lowercase, number, and special character.'
            });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            passwordResetTokenHash: hashedToken,
            passwordResetTokenExpiresAt: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
        }

        user.password = await bcrypt.hash(password, 10);
        user.passwordResetTokenHash = null;
        user.passwordResetTokenExpiresAt = null;
        user.authVersion = (user.authVersion ?? 0) + 1;

        await user.save();

        issueAuthCookie(res, user);
        res.status(200).json({
            user: serializeUser(user),
            message: 'Password reset successfully!'
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Unable to reset password.' });
    }
};

const logout = async (req, res) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            throw new Error('No token found!');
        }

        if (redisClient.isOpen) {
            await redisClient.setEx(`token:${token}`, 3600, 'blocked');
        }

        res.clearCookie('token', clearCookieOptions);
        res.status(200).json({ message: 'Logged out successfully!' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const adminRegister = async (req, res) => {
    try {
        validate(req.body);
        const emailID = normalizeEmail(req.body.emailID);
        const { firstName, password } = req.body;

        const existingUser = await User.findOne({ emailID });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        const user = await User.create({
            ...req.body,
            firstName: firstName.trim(),
            emailID,
            password: await bcrypt.hash(password, 10)
        });

        issueAuthCookie(res, user);
        res.status(201).json({ message: 'Admin Registered Successfully!' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        res.status(400).json({ message: err.message || String(err) });
    }
};

const deleteProfile = async (req, res) => {
    try {
        const userId = req.result._id;
        await User.findByIdAndDelete(userId);
        res.status(200).json({ message: 'Profile deleted successfully!' });
    } catch (_err) {
        res.status(500).json({ message: 'Internal Server Error!' });
    }
};

const getPublicAuthConfig = async (_req, res) => {
    res.status(200).json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || null,
        googleEnabled: !!process.env.GOOGLE_CLIENT_ID
    });
};

module.exports = {
    adminRegister,
    deleteProfile,
    forgotPassword,
    getPublicAuthConfig,
    googleLogin,
    login,
    logout,
    register,
    resetPassword
};
