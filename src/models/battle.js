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

const battleQuestionSchema = new Schema({
    _id: { type: Schema.Types.ObjectId, auto: true },
    problemId: { type: Schema.Types.ObjectId, ref: 'problem', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    constraints: { type: String, default: '' },
    examples: { type: [testCaseSchema], default: [] },
    visibleTestCases: { type: [testCaseSchema], default: [] },
    hiddenTestCases: { type: [testCaseSchema], default: [] },
    starterCode: { type: [starterCodeSchema], default: [] },
    points: { type: Number, default: 100 }
});

const playerSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    score: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    connectionStatus: { type: String, enum: ['connected', 'disconnected'], default: 'connected' },
    disconnectedAt: { type: Date, default: null },
    forfeitedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    acceptedQuestions: [{ type: Schema.Types.ObjectId }]
}, { _id: false });

const draftSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    questionId: { type: Schema.Types.ObjectId, required: true },
    language: { type: String, enum: ['javascript', 'java', 'c++'], required: true },
    code: { type: String, maxlength: 100000, default: '' },
    updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const battleSchema = new Schema({
    mode: { type: String, enum: ['friend', 'random'], required: true },
    status: { type: String, enum: ['WAITING', 'MATCHED', 'COUNTDOWN', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'], default: 'MATCHED', index: true },
    subject: { type: String, enum: ['DSA', 'DAA', 'OOPs', 'CProgramming'], required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    topic: { type: String, default: '' },
    durationMinutes: { type: Number, required: true, min: 1, max: 180 },
    pointsPerQuestion: { type: Number, default: 100 },
    incorrectPenalty: { type: Number, default: 10 },
    questions: { type: [battleQuestionSchema], default: [] },
    drafts: { type: [draftSchema], default: [] },
    players: {
        type: [playerSchema],
        validate: [
            { validator: (value) => value.length >= 2 && value.length <= 16, message: 'A battle requires 2 to 16 players.' },
            { validator: (value) => new Set(value.map((player) => String(player.userId))).size === value.length, message: 'A student can only join a battle once.' }
        ]
    },
    playerCount: { type: Number, required: true, min: 2, max: 16, default: 2 },
    pendingSubmissions: { type: Number, default: 0, min: 0 },
    invitationId: { type: Schema.Types.ObjectId, ref: 'battleInvitation', default: null },
    matchedAt: { type: Date, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    winnerId: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    winnerIds: [{ type: Schema.Types.ObjectId, ref: 'user' }],
    resultReason: { type: String, default: '' }
}, { timestamps: true });

battleSchema.index({ 'players.userId': 1, status: 1, createdAt: -1 });
battleSchema.index({ status: 1, endsAt: 1 });
battleSchema.index({ 'players.userId': 1, completedAt: -1 });

module.exports = mongoose.model('battle', battleSchema);
