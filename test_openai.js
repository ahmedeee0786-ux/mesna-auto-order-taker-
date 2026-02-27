const { OpenAI } = require("openai");
require("dotenv").config();

async function testOpenAI() {
    const key = process.env.AI_API_KEY;
    const baseUrl = "https://api.bytez.com/v1";
    const models = [
        "openai/gpt-4o-mini",
        "openai/gpt-3.5-turbo",
        "meta-llama/Meta-Llama-3-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.2",
        "llama3-8b-instruct",
        "gpt-3.5-turbo"
    ];

    for (const model of models) {
        try {
            console.log(`Testing model: ${model}...`);
            const openai = new OpenAI({ apiKey: key, baseURL: baseUrl });

            const response = await openai.chat.completions.create({
                model: model,
                messages: [{ role: "user", content: "Hi" }]
            });
            console.log(`✅ Success with model ${model}!`);
            process.exit(0);
        } catch (e) {
            console.error(`❌ Failed with model ${model}:`, e.status, e.message);
        }
    }
}

testOpenAI();
