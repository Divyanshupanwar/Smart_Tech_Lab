const axios = require('axios');

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
            'x-rapidapi-key': 'd7b77fb7c3msh4e36cb7582d9741p1a3dadjsnb67bae3572ae',
            'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
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

    const options = {
        method: 'GET',
        url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
        params: {
            tokens: resultToken.join(","),
            base64_encoded: 'false',
            fields: '*'
        },
        headers: {
            'x-rapidapi-key': 'd7b77fb7c3msh4e36cb7582d9741p1a3dadjsnb67bae3572ae',
            'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
        }
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

module.exports = { getLanguageById, submitBatch, submitToken };
