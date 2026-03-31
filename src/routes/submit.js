const express = require('express');
const userMiddleWare = require('../middleware/userMiddleWare');
const submitCodeRateLimiter = require('../middleware/submitRateLimiter');
const { submitCode, runCode, runPlaygroundCode } = require('../controllers/userSubmission');
const submitRouter = express.Router();


submitRouter.post("/submit/:id", userMiddleWare, submitCode);

//  only user authentication for running code
submitRouter.post("/run/:id", userMiddleWare, runCode);
submitRouter.post("/playground", userMiddleWare, runPlaygroundCode);

module.exports = submitRouter;
