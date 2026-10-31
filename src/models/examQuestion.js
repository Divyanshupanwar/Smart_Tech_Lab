const mongoose = require('mongoose');
const { Schema } = mongoose;

const testCaseSchema = new Schema({
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String, default: '' }
}, { _id: false });

const starterCodeSchema = new Schema({
    language: { type: String, enum: ['javascript', 'java', 'c++'], required: true },
    code: { type: String, default: '' }
}, { _id: false });

const examQuestionSchema = new Schema({
    examId: { type: Schema.Types.ObjectId, ref: 'labExam', required: true, index: true },
    sourceProblemId: { type: Schema.Types.ObjectId, ref: 'problem', default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 20000 },
    constraints: { type: String, default: '', maxlength: 5000 },
    examples: { type: [testCaseSchema], default: [] },
    visibleTestCases: { type: [testCaseSchema], default: [] },
    hiddenTestCases: { type: [testCaseSchema], default: [] },
    starterCode: { type: [starterCodeSchema], default: [] },
    marks: { type: Number, required: true, min: 1, max: 1000 },
    order: { type: Number, required: true, min: 0 }
}, { timestamps: true });

examQuestionSchema.index({ examId: 1, order: 1 });

module.exports = mongoose.model('examQuestion', examQuestionSchema);
