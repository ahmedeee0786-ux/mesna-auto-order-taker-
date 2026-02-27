const ai = require("./ai");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function syncMenu() {
    console.log("🚀 Starting Menu AI Sync (Local Edition)...");

    const imagePath = path.join(__dirname, 'menu.jpg');
    const configPath = path.join(__dirname, 'config.json');

    if (!fs.existsSync(imagePath)) {
        console.error("❌ Error: menu.jpg not found in folder!");
        return;
    }

    console.log("🧠 Extraction items from image (using Gemini Vision)...");
    const menuData = await ai.analyzeMenuImage(imagePath);

    if (!menuData) {
        console.error("❌ Error: Failed to extract menu data from image.");
        return;
    }

    console.log("📊 Extracted Categories:", Object.keys(menuData).join(", "));
    console.log("📝 Saving to local config.json...");

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.menu = menuData;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        console.log("✅ SUCCESS! Your local menu is now updated from the image.");
        console.log("Tip: Restart the bot (node index.js) if it's already running.");
    } catch (err) {
        console.error("❌ Error saving to config.json:", err);
    }
}

syncMenu();
