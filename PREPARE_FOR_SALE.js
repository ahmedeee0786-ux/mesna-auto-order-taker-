const fs = require('fs');
const path = require('path');

const sourceDir = __dirname;
const targetDir = path.join(__dirname, '..', 'MESNA_BOT_DELIVERY');

const filesToInclude = [
    'public',
    'ai.js',
    'index.js',
    'server.js',
    'sheets.js',
    'sync_menu.js',
    'config.json',
    'package.json',
    'package-lock.json',
    'logo.jpg',
    'menu.jpg',
    'RESELL_GUIDE.md',
    'START_MESNA.bat'
];

async function prepare() {
    console.log("🚀 Preparing Mesna Bot for delivery...");

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
    }

    // 1. Copy Files
    for (const file of filesToInclude) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);

        if (fs.existsSync(src)) {
            if (fs.lstatSync(src).isDirectory()) {
                copyDir(src, dest);
            } else {
                fs.copyFileSync(src, dest);
            }
            console.log(`✅ Copied: ${file}`);
        }
    }

    // 2. Create Clean .env
    const envExample = `
AI_API_KEY=PASTE_API_KEY_HERE
AI_PROVIDER=openai
AI_BASE_URL=https://api.bytez.com/v1
AI_MODEL=openai/gpt-4o-mini
GEMINI_API_KEY=PASTE_GEMINI_KEY_HERE
GOOGLE_SHEET_ID=PASTE_SHEET_ID_HERE
`.trim();
    fs.writeFileSync(path.join(targetDir, '.env'), envExample);
    console.log("✅ Created clean .env template.");

    // 3. Create placeholder service-account.json
    fs.writeFileSync(path.join(targetDir, 'service-account.json'), '{\n  "note": "Paste your Google Service Account JSON content here"\n}');
    console.log("✅ Created service-account.json placeholder.");

    console.log("\n✨ DONE! Aapka 'Clean Bot' folder ban gaya hai:");
    console.log(`📍 Location: ${targetDir}`);
    console.log("Ab aap is pure folder ko Zip kar ke client ko bhej saktay hain.");
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
    }
}

prepare().catch(console.error);
