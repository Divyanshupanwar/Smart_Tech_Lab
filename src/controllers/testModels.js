const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
        
        // Test different model names
        const modelsToTry = [
            "gemini-pro",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-1.5-pro-latest",
            "gemini-1.5-flash-latest",
            "models/gemini-pro",
            "models/gemini-1.5-flash"
        ];

        console.log("Testing model names...\n");

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                console.log(` ${modelName} - WORKS`);
            } catch (err) {
                console.log(` ${modelName} - Failed: ${err.message.substring(0, 100)}`);
            }
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

listModels();