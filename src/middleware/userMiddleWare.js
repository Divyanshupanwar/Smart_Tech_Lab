const jwt = require("jsonwebtoken");
const User = require("../models/user");
const redisClient = require("../config/redis");

const userMiddleWare = async (req, res, next) => {
    try {
        const { token } = req.cookies;
        if (!token)
            return res.status(401).json({ message: "Authentication required. Please login." });

        const payload = jwt.verify(token, process.env.JWT_KEY);
        const { _id } = payload;
        if (!_id) {
            return res.status(401).json({ message: "Invalid token!" });
        }

        const result = await User.findById(_id);
        if (!result)
            return res.status(401).json({ message: "User does not exist!" });

        // Check token is not present in redis blocklist
        if (redisClient.isOpen) {
            const IsBlocked = await redisClient.exists(`token:${token}`);
            if (IsBlocked)
                return res.status(401).json({ message: "Session expired. Please login again." });
        }

        req.result = result;
        next();
    } catch (err) {
        res.status(401).json({ message: "Authentication failed: " + err.message });
    }
};

module.exports = userMiddleWare;
