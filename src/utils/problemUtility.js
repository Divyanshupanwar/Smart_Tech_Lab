const axios = require('axios');
require('../config/loadEnv');
const { resolveJudge0Config } = require('./judge0Config');

const apiRequest = async (method, endpoint, { params, data } = {}) => {
    const config = resolveJudge0Config();
    try {
        const response = await axios.request({
            method,
            url: `${config.baseUrl}/submissions/${endpoint}`,
            params,
            headers: { ...config.headers, ...(data ? { 'Content-Type': 'application/json' } : {}) },
            data,
            timeout: 20000
        });
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const detail = status ? `HTTP ${status}` : 'network or timeout error';
        console.error(`Judge0 ${method} ${endpoint} failed (${detail}).`);
        throw new Error(`Judge0 request failed (${detail}). Check its URL, credentials, quota and availability.`);
    }
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
    if (!Array.isArray(submissions) || submissions.length === 0) throw new Error('At least one Judge0 submission is required.');
    return apiRequest('POST', 'batch', { params: { base64_encoded: 'false' }, data: { submissions } });
};

// ------------------- WAIT FUNCTION (FIXED) -------------------
const waiting = (time) => new Promise(resolve => setTimeout(resolve, time));

// ------------------- GET RESULTS FROM TOKENS -------------------
const submitToken = async (resultToken) => {
    if (!Array.isArray(resultToken) || resultToken.length === 0) {
        throw new Error('Judge0 submission tokens are required.');
    }
    const startedAt = Date.now();
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

    const params = {
            tokens: resultToken.join(","),
            base64_encoded: 'false',
            fields: requiredFields
    };

    while (true) {
        try {
            const response = await apiRequest('GET', 'batch', { params });
            const submissions = response.submissions;
            if (!Array.isArray(submissions)) {
                throw new Error('Judge0 returned an invalid batch response.');
            }

            // Judge0: status_id > 2 => Finished processing
            const allDone = submissions.length === resultToken.length && submissions.every(s => s.status_id > 2);

            if (allDone) return submissions;

        } catch (error) {
            if (/not configured|must be a valid|must use http|must be a hostname/i.test(error.message)) throw error;
            if (/Judge0 request failed \(HTTP 4\d\d\)/.test(error.message)) throw error;
        }

        if (Date.now() - startedAt > 120000) {
            throw new Error('Judge0 evaluation timed out after 120 seconds.');
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
