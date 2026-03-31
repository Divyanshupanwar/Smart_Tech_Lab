const mongoose = require('mongoose');
const {Schema} = mongoose;

const videoSchema = new Schema({
    problemId: {
        type: Schema.Types.ObjectId,
        ref: 'problem',
        required: true
    },
    userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
   },
   cloudinaryPublicId: {
    type: String,
    unique: true,
    sparse: true
  },
  secureUrl: {
    type: String,
    default: ''
  },
  thumbnailUrl: {
    type: String
  },
  youtubeUrl: {
    type: String,
    default: ''
  },
  provider: {
    type: String,
    enum: ['cloudinary', 'youtube'],
    default: 'cloudinary'
  },
  duration: {
    type: Number,
    default: 0
  },
},{
    timestamps:true
});



const SolutionVideo = mongoose.model("solutionVideo",videoSchema);

module.exports = SolutionVideo;
