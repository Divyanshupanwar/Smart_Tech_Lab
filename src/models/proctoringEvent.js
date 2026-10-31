const mongoose = require('mongoose');
const { Schema } = mongoose;

const proctoringEventSchema = new Schema({
    examId: { type: Schema.Types.ObjectId, ref: 'labExam', required: true },
    attemptId: { type: Schema.Types.ObjectId, ref: 'examAttempt', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    eventType: {
        type: String,
        enum: ['tab_hidden', 'window_blur', 'copy', 'paste', 'cut', 'context_menu', 'fullscreen_exit', 'camera_disconnected', 'microphone_disconnected', 'connection_interrupted', 'face_missing', 'multiple_faces', 'audio_activity', 'route_navigation'],
        required: true
    },
    severity: { type: String, enum: ['warning', 'strong_warning', 'flagged'], required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    receivedAt: { type: Date, required: true }
}, { timestamps: true });

proctoringEventSchema.index({ attemptId: 1, receivedAt: -1 });
proctoringEventSchema.index({ examId: 1, studentId: 1, receivedAt: -1 });

module.exports = mongoose.model('proctoringEvent', proctoringEventSchema);
