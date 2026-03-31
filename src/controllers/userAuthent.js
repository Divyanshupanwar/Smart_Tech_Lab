const redisClient = require("../config/redis");
const User = require("../models/user");
const validate = require("../utils/validator");
const bcrypt = require("bcrypt");
var jwt = require("jsonwebtoken");
const Submission = require("../models/submission");

const register = async (req, res) => {
    try {
        validate(req.body);
        const { firstName, emailID, password } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ emailID: emailID.toLowerCase().trim() });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists with this email. Please login instead." });
        }

        req.body.password = await bcrypt.hash(password, 10);
        req.body.role = 'user';
        const user = await User.create(req.body);
        const token = jwt.sign({ _id: user._id, emailID: emailID, role: user.role }, process.env.JWT_KEY, { expiresIn: 60 * 60 });
        res.cookie('token', token, { maxAge: 60 * 60 * 1000 });
        const reply = {
            firstName: user.firstName,
            emailID: user.emailID,
            _id: user._id,
            role: user.role
        };
        res.status(201).json({
            user: reply,
            message: "Registered Successfully!"
        });
    } catch (err) {
        const message = err.message || String(err);
        // Handle mongoose duplicate key error as fallback
        if (err.code === 11000) {
            return res.status(409).json({ message: "User already exists with this email. Please login instead." });
        }
        res.status(400).json({ message: message });
    }
};

const login = async (req, res) => {
    try {
        const { emailID, password } = req.body;
        if (!emailID)
            throw new Error("Email is required!");
        if (!password)
            throw new Error("Password is required!");
        const user = await User.findOne({ emailID });
        if (!user) throw new Error("Invalid email or password!");
        const match = await bcrypt.compare(password, user.password);

        if (!match)
            throw new Error("Invalid email or password!");
        const reply = {
            firstName: user.firstName,
            emailID: user.emailID,
            _id: user._id,
            role: user.role
        };
        const token = jwt.sign({ _id: user._id, emailID: emailID, role: user.role }, process.env.JWT_KEY, { expiresIn: 60 * 60 });
        res.cookie('token', token, { maxAge: 60 * 60 * 1000 });
        res.status(200).json({
            user: reply,
            message: "Login Successfully!"
        });
    } catch (err) {
        res.status(401).json({ message: err.message || "Invalid credentials" });
    }
};

const logout = async (req, res) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            throw new Error("No token found!");
        }

        // Add token to Redis blocklist with 1 hour expiration when Redis is available.
        if (redisClient.isOpen) {
            await redisClient.setEx(`token:${token}`, 3600, 'blocked');
        }

        // Clear the cookie
        res.clearCookie('token');

        res.status(200).json({ message: "Logged out successfully!" });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const adminRegister = async (req, res) => {
    try {
        validate(req.body);
        const { firstName, emailID, password } = req.body;

        const existingUser = await User.findOne({ emailID: emailID.toLowerCase().trim() });
        if (existingUser) {
            return res.status(409).json({ message: "Email already registered." });
        }

        req.body.password = await bcrypt.hash(password, 10);
        const user = await User.create(req.body);
        const token = jwt.sign({ _id: user._id, emailID: emailID, role: user.role }, process.env.JWT_KEY, { expiresIn: 60 * 60 });
        res.cookie('token', token, { maxAge: 60 * 60 * 1000 });
        res.status(201).json({ message: "Admin Registered Successfully!" });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Email already registered." });
        }
        res.status(400).json({ message: err.message || String(err) });
    }
};

const deleteProfile = async (req, res) => {
    try {
        const userId = req.result._id;
        await User.findByIdAndDelete(userId);
        res.status(200).json({ message: "Profile deleted successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error!" });
    }
};

module.exports = { register, login, logout, adminRegister, deleteProfile };
