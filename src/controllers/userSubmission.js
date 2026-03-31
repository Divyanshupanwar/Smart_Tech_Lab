const Problem = require("../models/problem");
const Submission = require("../models/submission");
const User = require("../models/user");
const {getLanguageById,submitBatch,submitToken,executeCode} = require("../utils/problemUtility");

const submitCode = async (req,res)=>{
   
    // 
    try{
      
       const userId = req.result._id;
       const problemId = req.params.id;

       let {code,language} = req.body;

      if(!userId||!code||!problemId||!language)
        return res.status(400).json({ message: "Some required fields are missing" });
      

      if(language==='cpp')
        language='c++'
      
    //    Fetch the problem from database
       const problem =  await Problem.findById(problemId);
       if (!problem) {
        return res.status(404).json({ message: "Problem not found" });
       }
    //    testcases(Hidden)
    
    //   Kya apne submission store kar du pehle....
    const submittedResult = await Submission.create({
          userId,
          problemId,
          code,
          language,
          status:'pending',
          testCasesTotal:problem.hiddenTestCases.length
     })

    //    Judge0 code ko submit karna hai
    
    const languageId = getLanguageById(language);
   
    const submissions = problem.hiddenTestCases.map((testcase)=>({
        source_code:code,
        language_id: languageId,
        stdin: testcase.input,
        expected_output: testcase.output
    }));

    
    const submitResult = await submitBatch(submissions);
    if (!Array.isArray(submitResult) || submitResult.length === 0) {
      throw new Error("Judge0 submission failed");
    }
    
    const resultToken = submitResult.map((value)=> value.token);

    const testResult = await submitToken(resultToken);
    

    // submittedResult ko update karo
    let testCasesPassed = 0;
    let runtime = 0;
    let memory = 0;
    let status = 'accepted';
    let errorMessage = null;


    for(const test of testResult){
        if(test.status_id==3){
           testCasesPassed++;
           runtime = runtime+parseFloat(test.time)
           memory = Math.max(memory,test.memory);
        }else{
          if(test.status_id==4 || test.status_id==6 || test.status_id==13){
            status = 'error'
            errorMessage = test.stderr || test.compile_output || test.message || test.status?.description || "Runtime error"
          }
          else{
            status = 'wrong'
            errorMessage = test.stderr || test.compile_output || test.message || test.status?.description || "Wrong answer"
          }
        }
    }


    // Store the result in Database in Submission
    submittedResult.status   = status;
    submittedResult.testCasesPassed = testCasesPassed;
    submittedResult.errorMessage = errorMessage;
    submittedResult.runtime = runtime;
    submittedResult.memory = memory;

    await submittedResult.save();
    
    // ProblemId ko insert karenge userSchema ke problemSolved mein if it is not persent there.
    
    // req.result == user Information

    if(status === 'accepted' && !req.result.problemSolved.some((id) => id.toString() === problemId.toString())){
      req.result.problemSolved.push(problemId);
      await req.result.save();
    }
    
    const accepted = (status == 'accepted')
    res.status(201).json({
      accepted,
      totalTestCases: submittedResult.testCasesTotal,
      passedTestCases: testCasesPassed,
      runtime,
      memory,
      status,
      errorMessage
    });
       
    }
    catch(err){
      console.error("Error submitting code:", err);
      res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
}


const runCode = async(req,res)=>{
    
     // 
     try{
      const userId = req.result._id;
      const problemId = req.params.id;

      let {code,language} = req.body;

     if(!userId||!code||!problemId||!language)
       return res.status(400).json({ message: "Some required fields are missing" });

   //    Fetch the problem from database
      const problem =  await Problem.findById(problemId);
      if (!problem) {
        return res.status(404).json({ message: "Problem not found" });
      }
   //    testcases(Hidden)
      if(language==='cpp')
        language='c++'

   //    Judge0 code ko submit karna hai

   const languageId = getLanguageById(language);

   const submissions = problem.visibleTestCases.map((testcase)=>({
       source_code:code,
       language_id: languageId,
       stdin: testcase.input,
       expected_output: testcase.output
   }));


   const submitResult = await submitBatch(submissions);
   if (!Array.isArray(submitResult) || submitResult.length === 0) {
    throw new Error("Judge0 submission failed");
   }
   
   const resultToken = submitResult.map((value)=> value.token);

   const testResult = await submitToken(resultToken);

    let testCasesPassed = 0;
    let runtime = 0;
    let memory = 0;
    let status = true;
    let errorMessage = null;

    for(const test of testResult){
        if(test.status_id==3){
           testCasesPassed++;
           runtime = runtime+parseFloat(test.time)
           memory = Math.max(memory,test.memory);
        }else{
          if(test.status_id==4){
            status = false
            errorMessage = test.stderr || test.compile_output || test.message || test.status?.description || "Runtime error"
          }
          else{
            status = false
            errorMessage = test.stderr || test.compile_output || test.message || test.status?.description || "Wrong answer"
          }
        }
    }

   
  
   res.status(201).json({
    success:status,
    testCases: testResult,
    runtime,
    memory,
    errorMessage
   });
      
   }
   catch(err){
     console.error("Error running code:", err);
     res.status(500).json({ message: "Internal Server Error", error: err.message });
   }
}

const runPlaygroundCode = async (req, res) => {
    try {
        let { code, language, stdin } = req.body;

        if (!code || !language) {
            return res.status(400).json({ message: "Code and language are required" });
        }

        if (language === 'cpp') {
            language = 'c++';
        }

        const languageId = getLanguageById(language);
        if (!languageId) {
            return res.status(400).json({ message: "Unsupported language selected" });
        }

        const result = await executeCode({
            source_code: code,
            language_id: languageId,
            stdin: stdin || ''
        });

        const statusId = result?.status_id;
        const statusDescription = result?.status?.description || 'Unknown status';
        const consoleOutput = result?.stdout || result?.stderr || result?.compile_output || result?.message || '';

        return res.status(200).json({
            success: statusId === 3,
            statusId,
            status: statusDescription,
            stdout: result?.stdout || '',
            stderr: result?.stderr || '',
            compileOutput: result?.compile_output || '',
            message: result?.message || '',
            console: consoleOutput,
            time: result?.time || null,
            memory: result?.memory || null
        });
    }
    catch (err) {
        console.error("Error running playground code:", err);
        res.status(500).json({ message: "Failed to run playground code", error: err.message });
    }
}


module.exports = {submitCode,runCode,runPlaygroundCode};



//     language_id: 54,
//     stdin: '2 3',
//     expected_output: '5',
//     stdout: '5',
//     status_id: 3,
//     created_at: '2025-05-12T16:47:37.239Z',
//     finished_at: '2025-05-12T16:47:37.695Z',
//     time: '0.002',
//     memory: 904,
//     stderr: null,
//     token: '611405fa-4f31-44a6-99c8-6f407bc14e73',


// User.findByIdUpdate({
// })

//const user =  User.findById(id)
// user.firstName = "Mohit";
// await user.save();
