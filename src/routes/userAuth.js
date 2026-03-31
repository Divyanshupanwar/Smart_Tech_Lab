const express = require('express');
const authRouter = express.Router();
const { register, login, logout,adminRegister,deleteProfile } = require('../controllers/userAuthent');
const userMiddleWare = require('../middleware/userMiddleWare');
const adminMiddleware = require('../middleware/adminMiddleware');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const redisClient = require('../config/redis');

authRouter.post('/register', register);
authRouter.post('/login', login);
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

        if (redisClient.isOpen) {
            const isBlocked = await redisClient.exists(`token:${token}`);
            if (isBlocked) {
                return res.status(200).json({ user: null, message: "Session expired" });
            }
        }

        const reply = {
            firstName: result.firstName,
            emailID: result.emailID,
            _id: result._id,
            role :result.role,
        };

        res.status(200).json({
            user:reply,
            message:"Valid User"
        });
    } catch (err) {
        res.status(200).json({ user: null, message: "No active session" });
    }
});
module.exports = authRouter;
