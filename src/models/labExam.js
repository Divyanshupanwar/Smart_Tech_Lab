const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionRefSchema = new Schema({
    questionId: { type: Schema.Types.ObjectId, ref: 'examQuestion', required: true },
    marks: { type: Number, required: true, min: 1, max: 1000 },
    order: { type: Number, required: true, min: 0 }
}, { _id: false });

const proctoringSchema = new Schema({
    tabVisibility: { type: Boolean, default: true },
    windowFocus: { type: Boolean, default: true },
    clipboard: { type: Boolean, default: true },
    contextMenu: { type: Boolean, default: true },
    fullscreen: { type: Boolean, default: true },
    camera: { type: Boolean, default: false },
    microphone: { type: Boolean, default: false },
    facePresence: { type: Boolean, default: false },
    audioActivity: { type: Boolean, default: false },
    terminateOnRouteChange: { type: Boolean, default: true },
    maxViolations: { type: Number, min: 0, max: 100, default: 3 },
    autoSubmitOnMaxViolations: { type: Boolean, default: true }
}, { _id: false });

const labExamSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 10000 },
    subject: { type: String, enum: ['DSA', 'DAA', 'OOPs', 'CProgramming'], required: true },
    semester: { type: String, trim: true, maxlength: 40, default: '' },
    batch: { type: String, trim: true, maxlength: 80, default: '' },
    targetStudents: [{ type: Schema.Types.ObjectId, ref: 'user' }],
    targetGroups: [{ type: String, trim: true, maxlength: 80 }],
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1, max: 600 },
    gracePeriodSeconds: { type: Number, min: 0, max: 3600, default: 0 },
    maxAttempts: { type: Number, required: true, min: 1, max: 10, default: 1 },
    totalMarks: { type: Number, required: true, min: 1 },
    questions: { type: [questionRefSchema], default: [] },
    proctoring: { type: proctoringSchema, default: () => ({}) },
    autoSubmit: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
        default: 'DRAFT',
        index: true
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true }
}, { timestamps: true });

labExamSchema.index({ subject: 1, status: 1, startAt: 1 });
labExamSchema.index({ startAt: 1, endAt: 1 });
labExamSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('labExam', labExamSchema);
