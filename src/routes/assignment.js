const express = require('express');
const assignmentRouter = express.Router();
const userMiddleWare = require('../middleware/userMiddleWare');
const adminMiddleware = require('../middleware/adminMiddleware');
const { createAssignment, getAssignmentsBySubject, getAllAssignments, submitAssignment, getMySubmissions, gradeAssignment } = require('../controllers/assignment');

// Admin routes
assignmentRouter.post("/create", adminMiddleware, createAssignment);
assignmentRouter.put("/grade/:submissionId", adminMiddleware, gradeAssignment);

// User routes
assignmentRouter.get("/all", userMiddleWare, getAllAssignments);
assignmentRouter.get("/bySubject/:subject", userMiddleWare, getAssignmentsBySubject);
assignmentRouter.post("/submit/:assignmentId", userMiddleWare, submitAssignment);
assignmentRouter.get("/mySubmissions", userMiddleWare, getMySubmissions);

module.exports = assignmentRouter;
