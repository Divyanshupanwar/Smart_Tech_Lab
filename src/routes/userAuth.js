const express = require('express');
const authRouter = express.Router();
const {
    register,
    login,
    logout,
    adminRegister,
    deleteProfile,
    forgotPassword,
    getPublicAuthConfig,
    resetPassword,
    googleLogin
} = require('../controllers/userAuthent');
const userMiddleWare = require('../middleware/userMiddleWare');
const adminMiddleware = require('../middleware/adminMiddleware');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const redisClient = require('../config/redis');
const { serializeUser } = require('../utils/auth');

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/google-login', googleLogin);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password/:token', resetPassword);
authRouter.get('/public-auth-config', getPublicAuthConfig);
authRouter.post('/logout',userMiddleWare,logout);
authRouter.post('/admin/register',adminMiddleware,adminRegister);
authRouter.delete('/deleteProfile',userMiddleWare,deleteProfile);
authRouter.get('/check', async (req,res)=>{
    try {
        const { token } = req.cookies;
        if (!token) {
            return res.status(200).json({ user: null, message: "No active session" });
        }

        const payload = jwt.verify(token, process.env.JWT_KEY);
        const result = await User.findById(payload._id);
        if (!result) {
            return res.status(200).json({ user: null, message: "User not found" });
        }

        if ((payload.authVersion ?? 0) !== (result.authVersion ?? 0)) {
            return res.status(200).json({ user: null, message: "Session expired" });
        }

        if (redisClient.isOpen) {
            const isBlocked = await redisClient.exists(`token:${token}`);
            if (isBlocked) {
                return res.status(200).json({ user: null, message: "Session expired" });
            }
        }

        res.status(200).json({
            user:serializeUser(result),
            message:"Valid User"
        });
    } catch (err) {
        res.status(200).json({ user: null, message: "No active session" });
    }
});
module.exports = authRouter;
