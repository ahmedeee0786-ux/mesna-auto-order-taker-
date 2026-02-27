const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const models = await genAI.listModels();
        console.log("Available Models:");
        models.models.forEach(m => {
            console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(", ")})`);
        });
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
