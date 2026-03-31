const { Assignment, AssignmentSubmission } = require('../models/assignment');

// Admin: Create assignment
const createAssignment = async (req, res) => {
    try {
        const { title, description, subject, dueDate, totalMarks, problems, pdfUrl } = req.body;
        const assignment = await Assignment.create({
            title,
            description,
            subject,
            dueDate,
            totalMarks: totalMarks || 100,
            pdfUrl: pdfUrl || '',
            problems: problems || [],
            createdBy: req.result._id,
        });
        res.status(201).json({ message: "Assignment created successfully!", assignment });
    } catch (err) {
        res.status(400).send("Error: " + err);
    }
}

// Get assignments by subject
const getAssignmentsBySubject = async (req, res) => {
    try {
        const { subject } = req.params;
        const validSubjects = ['DSA', 'DAA', 'OOPs', 'CProgramming'];
        
        if (!validSubjects.includes(subject)) {
            return res.status(400).send("Invalid subject");
        }
        
        const assignments = await Assignment.find({ subject })
            .populate('createdBy', 'firstName')
            .sort({ dueDate: 1 });
        
        // Get user's submissions for these assignments
        const userId = req.result._id;
        const assignmentIds = assignments.map(a => a._id);
        const userSubmissions = await AssignmentSubmission.find({
            assignmentId: { $in: assignmentIds },
            userId
        });
        
        const submissionMap = {};
        userSubmissions.forEach(sub => {
            submissionMap[sub.assignmentId.toString()] = sub;
        });
        
        const result = assignments.map(a => ({
            ...a.toObject(),
            userSubmission: submissionMap[a._id.toString()] || null,
        }));
        
        return res.status(200).json(result);
    } catch (err) {
        res.status(500).send("Error: " + err);
    }
}

// Get all assignments
const getAllAssignments = async (req, res) => {
    try {
        const assignments = await Assignment.find({})
            .populate('createdBy', 'firstName')
            .sort({ dueDate: 1 });
        return res.status(200).json(assignments);
    } catch (err) {
        res.status(500).send("Error: " + err);
    }
}

// Submit assignment
const submitAssignment = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { code, language, remarks } = req.body;
        const userId = req.result._id;
        
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).send("Assignment not found");
        }
        
        // Check if already submitted
        let submission = await AssignmentSubmission.findOne({ assignmentId, userId });
        
        const isLate = new Date() > new Date(assignment.dueDate);
        
        if (submission) {
            // Update existing submission
            submission.code = code || submission.code;
            submission.language = language || submission.language;
            submission.remarks = remarks || submission.remarks;
            submission.status = isLate ? 'late' : 'submitted';
            await submission.save();
        } else {
            // Create new submission
            submission = await AssignmentSubmission.create({
                assignmentId,
                userId,
                code: code || '',
                language: language || 'javascript',
                remarks: remarks || '',
                status: isLate ? 'late' : 'submitted',
            });
        }
        
        res.status(201).json({ message: "Assignment submitted successfully!", submission });
    } catch (err) {
        res.status(500).send("Error: " + err);
    }
}

// Get user's assignment submissions
const getMySubmissions = async (req, res) => {
    try {
        const userId = req.result._id;
        const submissions = await AssignmentSubmission.find({ userId })
            .populate({
                path: 'assignmentId',
                select: 'title subject dueDate totalMarks'
            })
            .sort({ createdAt: -1 });
        
        return res.status(200).json(submissions);
    } catch (err) {
        res.status(500).send("Error: " + err);
    }
}

// Admin: Grade assignment
const gradeAssignment = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { grade, feedback } = req.body;
        
        const submission = await AssignmentSubmission.findById(submissionId);
        if (!submission) {
            return res.status(404).send("Submission not found");
        }
        
        submission.grade = grade;
        submission.feedback = feedback || '';
        submission.status = 'graded';
        await submission.save();
        
        res.status(200).json({ message: "Graded successfully!", submission });
    } catch (err) {
        res.status(500).send("Error: " + err);
    }
}

module.exports = { createAssignment, getAssignmentsBySubject, getAllAssignments, submitAssignment, getMySubmissions, gradeAssignment };
