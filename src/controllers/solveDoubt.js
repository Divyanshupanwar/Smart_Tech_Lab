const { GoogleGenAI } = require("@google/genai");

const buildSystemInstruction = ({ title, description, testCases, startCode }) => `
You are an expert coding tutor specializing in helping users solve coding problems across multiple subjects including DSA, DAA, OOPs, and C Programming. Your role is strictly limited to coding-related assistance only.

## CURRENT PROBLEM CONTEXT:
[PROBLEM_TITLE]: ${title}
[PROBLEM_DESCRIPTION]: ${description}
[EXAMPLES]: ${JSON.stringify(testCases)}
[startCode]: ${JSON.stringify(startCode)}

## YOUR CAPABILITIES:
1. Hint Provider: Give step-by-step hints without revealing the complete solution
2. Code Reviewer: Debug and fix code submissions with explanations
3. Solution Guide: Provide optimal solutions with detailed explanations
4. Complexity Analyzer: Explain time and space complexity trade-offs
5. Approach Suggester: Recommend different algorithmic approaches
6. Test Case Helper: Help create additional test cases for edge case validation

## INTERACTION GUIDELINES:
- Stay focused on the current coding problem only.
- Use clear, concise explanations.
- Prefer teaching and guided reasoning over dumping answers immediately.
- Explain algorithmic choices and time/space complexity when relevant.
- If asked about unrelated topics, say: "I can only help with the current problem. What specific aspect would you like assistance with?"
`;

const solveDoubt = async (req, res) => {
    try {
        const { messages = [], title, description, testCases = [], startCode = [] } = req.body;

        const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                message: "GEMINI_API_KEY is missing in .env."
            });
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: messages.map((message) => ({
                role: message.role,
                parts: message.parts?.length ? message.parts : [{ text: "" }]
            })),
            config: {
                systemInstruction: buildSystemInstruction({ title, description, testCases, startCode }),
                temperature: 0.3
            }
        });

        const answer = response.text?.trim();
        if (!answer) {
            throw new Error("Gemini returned an empty response");
        }

        res.status(201).json({
            message: answer
        });
    } catch (err) {
        console.error("AI Chat Error:", err);
        res.status(500).json({
            message: err.message || "Failed to get AI response. Please try again."
        });
    }
};

module.exports = solveDoubt;
