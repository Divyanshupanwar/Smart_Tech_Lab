const axios = require('axios');

const judgeHeaders = {
    'x-rapidapi-key': process.env.JUDGE0_API_KEY || process.env.RAPIDAPI_KEY || 'd7b77fb7c3msh4e36cb7582d9741p1a3dadjsnb67bae3572ae',
    'x-rapidapi-host': process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com'
};

const getLanguageById = (lang) => {
    const language = {
        "c++": 54,
        "java": 62,
        "javascript": 63
    };
    return language[lang.toLowerCase()];
};

// ------------------- SUBMIT BATCH -------------------
const submitBatch = async (submissions) => {
    const options = {
        method: 'POST',
        url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
        params: {
            base64_encoded: 'false'
        },
        headers: {
            ...judgeHeaders,
            'Content-Type': 'application/json'
        },
        data: {
            submissions
        }
    };

    try {
        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        console.error("Submit Batch Error:", error.response?.data || error);
    }
};

// ------------------- WAIT FUNCTION (FIXED) -------------------
const waiting = (time) => new Promise(resolve => setTimeout(resolve, time));

// ------------------- GET RESULTS FROM TOKENS -------------------
const submitToken = async (resultToken) => {
    const requiredFields = [
        'token',
        'source_code',
        'language_id',
        'stdin',
        'expected_output',
        'stdout',
        'status_id',
        'time',
        'memory',
        'stderr',
        'compile_output',
        'message',
        'created_at',
        'finished_at',
        'status'
    ].join(',');

    const options = {
        method: 'GET',
        url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
        params: {
            tokens: resultToken.join(","),
            base64_encoded: 'false',
            fields: requiredFields
        },
        headers: judgeHeaders
    };

    while (true) {
        try {
            const response = await axios.request(options);
            const submissions = response.data.submissions;

            // Judge0: status_id > 2 => Finished processing
            const allDone = submissions.every(s => s.status_id > 2);

            if (allDone) return submissions;

        } catch (error) {
            console.error("Fetch Token Error:", error.response?.data || error);
        }

        await waiting(1000); // wait 1 second
    }
};

const executeCode = async ({ source_code, language_id, stdin = '' }) => {
    const submitResult = await submitBatch([
        {
            source_code,
            language_id,
            stdin
        }
    ]);

    if (!Array.isArray(submitResult) || !submitResult[0]?.token) {
        throw new Error('Judge0 playground submission failed');
    }

    const [result] = await submitToken([submitResult[0].token]);
    return result;
};

module.exports = { getLanguageById, submitBatch, submitToken, executeCode };
