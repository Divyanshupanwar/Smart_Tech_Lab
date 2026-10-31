const mongoose = require('mongoose');
const { Schema } = mongoose;

const studentBattleStatsSchema = new Schema({
    studentId: { type: Schema.Types.ObjectId, ref: 'user', required: true, unique: true },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalBattles: { type: Number, default: 0 },
    rating: { type: Number, default: 1000 },
    totalScore: { type: Number, default: 0 },
    weeklyScore: { type: Number, default: 0 }
}, { timestamps: true });

studentBattleStatsSchema.index({ rating: -1, wins: -1 });

module.exports = mongoose.model('studentBattleStats', studentBattleStatsSchema);
