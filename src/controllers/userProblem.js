const { getLanguageById, submitBatch, submitToken } = require("../utils/problemUtility");
const Problem = require("../models/problem");
const User = require("../models/user");
const Submission = require("../models/submission");
const SolutionVideo = require("../models/solutionVideo");

const SUBJECT_ALIASES = {
    dsa: "DSA",
    daa: "DAA",
    oops: "OOPs",
    oop: "OOPs",
    objectorientedprogramming: "OOPs",
    cprogramming: "CProgramming",
    c: "CProgramming"
};

const TAG_SUBJECT_MAP = {
    array: "DSA",
    linkedlist: "DSA",
    graph: "DSA",
    dp: "DSA",
    stack: "DSA",
    queue: "DSA",
    tree: "DSA",
    string: "DSA",
    math: "DSA",
    bitmanipulation: "DSA",
    sorting: "DAA",
    searching: "DAA",
    greedy: "DAA",
    divideandconquer: "DAA",
    dynamicprogramming: "DAA",
    branchandbound: "DAA",
    networkflow: "DAA",
    classes: "OOPs",
    inheritance: "OOPs",
    polymorphism: "OOPs",
    encapsulation: "OOPs",
    abstraction: "OOPs",
    pointers: "CProgramming",
    structures: "CProgramming",
    filehandling: "CProgramming",
    functions: "CProgramming",
    loops: "CProgramming"
};

const normalizeSubject = (value) => {
    if (!value || typeof value !== "string") {
        return null;
    }

    const compact = value.replace(/[\s&_/-]+/g, "").toLowerCase();
    return SUBJECT_ALIASES[compact] || value;
};

const normalizeDifficulty = (value) => {
    if (!value || typeof value !== "string") {
        return value;
    }

    const normalized = value.toLowerCase();
    return ["easy", "medium", "hard"].includes(normalized) ? normalized : value;
};

const deriveSubjectFromProblem = (problem = {}) => {
    const normalizedSubject = normalizeSubject(problem.subject);
    if (normalizedSubject && normalizedSubject !== problem.subject) {
        return normalizedSubject;
    }
    if (normalizedSubject) {
        return normalizedSubject;
    }

    const normalizedTag = typeof problem.tags === "string"
        ? problem.tags.replace(/[\s&_/-]+/g, "").toLowerCase()
        : "";

    return TAG_SUBJECT_MAP[normalizedTag] || null;
};

const hydrateProblem = (problem) => {
    const plainProblem = typeof problem?.toObject === "function" ? problem.toObject() : { ...problem };
    return {
        ...plainProblem,
        subject: deriveSubjectFromProblem(plainProblem),
        difficulty: normalizeDifficulty(plainProblem.difficulty)
    };
};

const buildProblemFilters = (query = {}, params = {}) => {
    const subject = normalizeSubject(params.subject || query.subject || query.category);
    const difficulty = typeof query.difficulty === "string" ? query.difficulty.toLowerCase() : null;
    const tag = typeof query.tag === "string" ? query.tag : null;

    const filters = {};

    if (subject) {
        filters.subject = subject;
    }

    if (difficulty) {
        filters.difficulty = difficulty;
    }

    if (tag) {
        filters.tags = tag;
    }

    return filters;
};

const serializeProblemList = (problems, filters = {}) => ({
    success: true,
    count: problems.length,
    filters,
    problems
});

const createProblem = async(req,res)=>{
    const {title,description,difficulty,subject,tags,visibleTestCases,hiddenTestCases,startCode,referenceSolution} = req.body;
    try{
        for (const {language,completeCode} of referenceSolution){
            const languageId = getLanguageById(language);
            const submissions = visibleTestCases.map((testcase)=>({
                source_code: completeCode,
                language_id: languageId,
                stdin: testcase.input,
                expected_output: testcase.output
            }));

            const submitResult = await submitBatch(submissions);
            const resultToken = submitResult.map((value)=> value.token);
            const testResult = await submitToken(resultToken);
            for(const test of testResult){
                if(test.status_id != 3){
                    return res.status(401).send("Error Occured!");
                }
            }
        }
        const userProblem = await Problem.create({
            ...req.body,
            problemCreator: req.result._id,
        });
        res.status(201).send("Problem Saved succesfully!");
    }
    catch(err){
        res.status(400).send("Error"+err);
    }
}

const updateProblem = async(req,res)=>{
    const {id} = req.params;
    const {title,description,difficulty,subject,tags,visibleTestCases,hiddenTestCases,startCode,referenceSolution} = req.body;
    try{
        if(!id) return res.status(400).send("Invalid ID !");
        const DsaProblem = await Problem.findById(id);
        if(!DsaProblem){
            return res.status(404).send("Id is not present in the server ");
        }
        for (const {language,completeCode} of referenceSolution){
            const languageId = getLanguageById(language);
            const submissions = visibleTestCases.map((testcase)=>({
                source_code: completeCode,
                language_id: languageId,
                stdin: testcase.input,
                expected_output: testcase.output
            }));

            const submitResult = await submitBatch(submissions);
            const resultToken = submitResult.map((value)=> value.token);
            const testResult = await submitToken(resultToken);
            for(const test of testResult){
                if(test.status_id != 3){
                    return res.status(401).send("Error Occured!");
                }
            }
        }
        const newProblem = await Problem.findByIdAndUpdate(id,{...req.body},{runValidators:true,new:true});
        res.status(200).send(newProblem);
    }
    catch(err){
        res.status(500).send("Error"+err);
    }
}

const deleteProblem = async(req,res)=>{
    const{id} = req.params;
    try{
        if(!id){
            return res.status(400).send("Id is missing");
        }
        const deletedProblem = await Problem.findByIdAndDelete(id);
        if(!deletedProblem)
            return res.status(404).send("Problem Not Found");
        return res.status(200).send("Successfully deleted!");
    }
    catch(err){
        res.status(500).send("Error"+err);
    }
}

const getProblemById = async (req, res) => {
    const { id } = req.params;

    try {
        if (!id) {
            return res.status(400).json({ message: "Problem id is required" });
        }

        const getProblem = await Problem.findById(id)
            .select("_id title description difficulty subject tags visibleTestCases startCode referenceSolution");

        if (!getProblem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        const editorial = await SolutionVideo.findOne({ problemId: id })
            .sort({ createdAt: -1 })
            .select("secureUrl thumbnailUrl duration youtubeUrl provider");

        return res.status(200).json({
            success: true,
            problem: {
                ...hydrateProblem(getProblem),
                secureUrl: editorial?.secureUrl || null,
                thumbnailUrl: editorial?.thumbnailUrl || null,
                duration: editorial?.duration || 0,
                youtubeUrl: editorial?.youtubeUrl || null,
                videoProvider: editorial?.provider || null
            }
        });
    } catch (err) {
        console.error("Error fetching problem by id:", err);
        res.status(500).json({ message: "Failed to fetch problem" });
    }
};

const getAllProblem = async (req, res) => {
    try {
        const filters = buildProblemFilters(req.query);
        const getProblem = await Problem.find({}).select("_id title difficulty subject tags");
        const hydratedProblems = getProblem.map(hydrateProblem);
        const filteredProblems = hydratedProblems.filter((problem) => {
            if (filters.subject && problem.subject !== filters.subject) {
                return false;
            }

            if (filters.difficulty && problem.difficulty !== filters.difficulty) {
                return false;
            }

            if (filters.tags && problem.tags !== filters.tags) {
                return false;
            }

            return true;
        });

        return res.status(200).json(serializeProblemList(filteredProblems, filters));
    } catch (err) {
        console.error("Error fetching problems:", err);
        res.status(500).json({ message: "Failed to fetch problems" });
    }
};

const getProblemsBySubject = async (req, res) => {
    try {
        const filters = buildProblemFilters(req.query, req.params);

        if (!filters.subject) {
            return res.status(400).json({ message: "A valid subject is required" });
        }

        const problems = await Problem.find({}).select("_id title difficulty subject tags");
        const hydratedProblems = problems.map(hydrateProblem);
        const filteredProblems = hydratedProblems.filter((problem) => problem.subject === filters.subject);
        return res.status(200).json(serializeProblemList(filteredProblems, filters));
    } catch (err) {
        console.error("Error fetching problems by subject:", err);
        res.status(500).json({ message: "Failed to fetch problems by subject" });
    }
};

const getProblemsByCategory = async (req, res) => {
    try {
        const filters = buildProblemFilters(req.query, { subject: req.params.category });

        if (!filters.subject) {
            return res.status(400).json({ message: "A valid category is required" });
        }

        const problems = await Problem.find({}).select("_id title difficulty subject tags");
        const hydratedProblems = problems.map(hydrateProblem);
        const filteredProblems = hydratedProblems.filter((problem) => problem.subject === filters.subject);
        return res.status(200).json(serializeProblemList(filteredProblems, filters));
    } catch (err) {
        console.error("Error fetching problems by category:", err);
        res.status(500).json({ message: "Failed to fetch problems by category" });
    }
};

const getSubjectStats = async(req, res) => {
    try {
        const problems = await Problem.find({}).select("_id subject difficulty tags");
        const statsMap = new Map();

        for (const problem of problems.map(hydrateProblem)) {
            if (!problem.subject) {
                continue;
            }

            if (!statsMap.has(problem.subject)) {
                statsMap.set(problem.subject, {
                    _id: problem.subject,
                    count: 0,
                    easy: 0,
                    medium: 0,
                    hard: 0
                });
            }

            const subjectStats = statsMap.get(problem.subject);
            subjectStats.count += 1;
            if (problem.difficulty === "easy") subjectStats.easy += 1;
            if (problem.difficulty === "medium") subjectStats.medium += 1;
            if (problem.difficulty === "hard") subjectStats.hard += 1;
        }

        const stats = Array.from(statsMap.values());
        return res.status(200).json({
            success: true,
            stats
        });
    } catch(err) {
        console.error("Error fetching subject stats:", err);
        res.status(500).json({ message: "Failed to fetch subject stats" });
    }
}

const getUserStats = async(req, res) => {
    try {
        const userId = req.result._id;
        
        const user = await User.findById(userId).populate({
            path: 'problemSolved',
            select: '_id title difficulty subject tags'
        });
        
        if (!user) return res.status(404).json({ message: "User not found!" });
        
        const submissions = await Submission.find({ userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate({
                path: 'problemId',
                select: '_id title difficulty subject'
            });

        const allProblems = await Problem.find({}).select("_id title difficulty subject tags");
        const hydratedAllProblems = allProblems.map(hydrateProblem);
        const hydratedSolvedProblems = user.problemSolved.map(hydrateProblem);
        
        const subjectStats = {};
        const subjects = ['DSA', 'DAA', 'OOPs', 'CProgramming'];
        
        for (const subject of subjects) {
            const totalProblems = hydratedAllProblems.filter((problem) => problem.subject === subject).length;
            const solvedInSubject = hydratedSolvedProblems.filter((p) => p.subject === subject).length;
            subjectStats[subject] = {
                total: totalProblems,
                solved: solvedInSubject,
            };
        }
        
        const totalSubmissions = await Submission.countDocuments({ userId });
        const acceptedSubmissions = await Submission.countDocuments({ userId, status: 'accepted' });
        
        return res.status(200).json({
            success: true,
            user: {
                firstName: user.firstName,
                emailID: user.emailID,
                _id: user._id,
            },
            totalSolved: user.problemSolved.length,
            solvedProblems: user.problemSolved.map(hydrateProblem),
            recentSubmissions: submissions,
            subjectStats,
            totalSubmissions,
            acceptedSubmissions,
            successRate: totalSubmissions > 0 ? Math.round((acceptedSubmissions / totalSubmissions) * 100) : 0,
        });
    } catch(err) {
        console.error("Error fetching user stats:", err);
        res.status(500).json({ message: "Failed to fetch user stats" });
    }
}

const solvedAllProblemByUser = async(req,res)=>{
    try{
        const userId = req.result._id;
        const user = await User.findById(userId).populate({
            path:"problemSolved",
            select:"_id title difficulty tags subject"
        });
        if(!user)
            return res.status(404).json({ message: "User not found!" });
        res.status(200).json({
            success: true,
            problems: user.problemSolved.map(hydrateProblem)
        });
    }
    catch(err){
        console.error("Error fetching solved problems:", err);
        res.status(500).json({ message: "Failed to fetch solved problems" });
    }
}

const submittedProblem = async(req,res)=>{
    try{
        const userId = req.result._id;
        const problemId = req.params.pid;
        const ans = await Submission.find({userId,problemId}).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            submissions: ans
        });
    }
    catch(err){
        console.error("Error fetching submitted problems:", err);
        res.status(500).json({ message: "Failed to fetch submission history" });
    }
}

module.exports = {createProblem,updateProblem,deleteProblem,getProblemById,getAllProblem,getProblemsBySubject,getProblemsByCategory,getSubjectStats,getUserStats,solvedAllProblemByUser,submittedProblem};
