const mongoose = require('mongoose');
const {Schema} = mongoose;

const userSchema = new Schema({
    firstName:{
        type:String,
        required:true,
        minLength :3,
        maxLength :20,
    },
    lastName:{
        type:String, 
        minLength :3,
        maxLength : 20,
    },
    emailID:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true,
        immutable:true,
    },
    age:{
        type:Number,
        min:5,
        max:70,

    },
    role:{
        type:String,
        enum:['user','admin'],
        default:'user',
    

    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    authVersion: {
        type: Number,
        default: 0
    },
    passwordResetTokenHash: {
        type: String,
        default: null
    },
    passwordResetTokenExpiresAt: {
        type: Date,
        default: null
    },
    problemSolved:{
        type:[{
            type:Schema.Types.ObjectId,
            ref :'problem'

        }],
        unique:true,

    },
    password:{
        type:String,
        required: function () {
            return !this.googleId;
        },
    }
},{
    timestamps:true


});


userSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await mongoose.model('submission').deleteMany({ userId: doc._id });
  }
});
 
const  User  = mongoose.model("user",userSchema);
module.exports =  User;
 
