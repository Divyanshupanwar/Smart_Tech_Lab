const mongoose = require('mongoose');
const {Schema} = mongoose;
const problemSchema = new Schema({
    title:{
        type:String,
        required:true,

    },
    description:{
        type:String,
        required:true,
    },
    difficulty:{
        type:String,
        enum:['easy','medium','hard'],
        required:true,

    },
    subject:{
        type:String,
        enum:['DSA','DAA','OOPs','CProgramming'],
        required:true,
    },
    tags:{
        type:String,
        enum:['array','LinkedList','Graph','DP','Stack','Queue','Tree','Sorting','Searching','Greedy','Backtracking','Recursion','String','Math','BitManipulation','Classes','Inheritance','Polymorphism','Encapsulation','Abstraction','Pointers','Structures','FileHandling','Functions','Loops','DivideAndConquer','DynamicProgramming','BranchAndBound','NetworkFlow'],
        required:true,

    },
    visibleTestCases:[
        {
            input:{
                type:String,
                required:true,
            },
            output:{
                type:String,
                required:true,

            },
            explanation:{
                type:String,
                required:true,
            }

        }
    ],
    hiddenTestCases:[
        {
            input:{
                type:String,
                required:true,
            },
            output:{
                type:String,
                required:true,

            }

        }
    ],
    referenceSolution:[{
        language:{
            type:String,
            required:true,
        },
        completeCode:{
            type:String,
            required:true,

        }
    }],
    startCode:[
       {
        language:{
            type:String,
            required:true,

        },
        initialCode:{
            type:String,
            required:true,
        }
       }
    ],
    problemCreator:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true,

    }
})
problemSchema.index({subject:1});
const Problem  = mongoose.model('problem',problemSchema);
module.exports =Problem;


