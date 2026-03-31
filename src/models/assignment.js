const mongoose = require('mongoose');
const { Schema } = mongoose;

const assignmentSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        enum: ['DSA', 'DAA', 'OOPs', 'CProgramming'],
        required: true,
    },
    dueDate: {
        type: Date,
        required: true,
    },
    totalMarks: {
        type: Number,
        required: true,
        default: 100,
    },
    pdfUrl: {
        type: String,
        default: '',
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    problems: [{
        type: Schema.Types.ObjectId,
        ref: 'problem',
    }],
}, {
    timestamps: true
});

const assignmentSubmissionSchema = new Schema({
    assignmentId: {
        type: Schema.Types.ObjectId,
        ref: 'assignment',
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    fileUrl: {
        type: String,
        default: '',
    },
    code: {
        type: String,
        default: '',
    },
    language: {
        type: String,
        enum: ['javascript', 'c++', 'java', 'python'],
        default: 'javascript',
    },
    remarks: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['pending', 'submitted', 'graded', 'late'],
        default: 'pending',
    },
    grade: {
        type: Number,
        default: 0,
    },
    feedback: {
        type: String,
        default: '',
    },
}, {
    timestamps: true
});

assignmentSubmissionSchema.index({ assignmentId: 1, userId: 1 });
assignmentSchema.index({ subject: 1 });

const Assignment = mongoose.model('assignment', assignmentSchema);
const AssignmentSubmission = mongoose.model('assignmentSubmission', assignmentSubmissionSchema);

module.exports = { Assignment, AssignmentSubmission };
