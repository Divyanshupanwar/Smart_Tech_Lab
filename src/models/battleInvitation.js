const mongoose = require('mongoose');
const { Schema } = mongoose;

const battleInvitationSchema = new Schema({
    fromUserId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    subject: { type: String, enum: ['DSA', 'DAA', 'OOPs', 'CProgramming'], required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    topic: { type: String, default: '' },
    durationMinutes: { type: Number, min: 1, max: 180, default: 20 },
    questionCount: { type: Number, min: 1, max: 5, default: 1 },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'], default: 'pending' },
    battleId: { type: Schema.Types.ObjectId, ref: 'battle', default: null },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

battleInvitationSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
battleInvitationSchema.index({ fromUserId: 1, status: 1, createdAt: -1 });
battleInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('battleInvitation', battleInvitationSchema);
