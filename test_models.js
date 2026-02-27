const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testModels() {
    const key = process.env.AI_API_KEY;
    const genAI = new GoogleGenerativeAI(key);

    const modelsToTest = [
        "models/gemini-flash-latest",
        "models/gemini-pro-latest",
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro",
        "models/gemini-1.0-pro"
    ];

    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi");
            console.log(`✅ Success with ${modelName}!`);
            return; // Stop if one works
        } catch (e) {
            console.error(`❌ Failed with ${modelName}:`, e.status, e.statusText || e.message);
        }
    }
}

testModels();
