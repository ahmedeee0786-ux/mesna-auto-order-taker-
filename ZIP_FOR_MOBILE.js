const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const folderName = 'mesna-bot-mobile';
const zipName = 'mesna-bot.zip';

console.log("🚀 Preparing Mesna Bot for Mobile Transfer...");

// Files to include
const filesToInclude = [
    'index.js', 'ai.js', 'sheets.js', 'server.js', 'config.json',
    'package.json', 'package-lock.json', '.env', 'profiles.json',
    'logo.jpg', 'menu.jpg', 'public', 'service-account.json'
];

try {
    // Check if zip command exists (Windows)
    console.log("📦 Creating ZIP file...");

    // We'll use a simple approach: zip everything except common heavy folders
    // Using powershell for native windows support
    const excludeList = "node_modules, .git, .wwebjs_auth, .wwebjs_cache, tmp";
    const command = `powershell -Command "Compress-Archive -Path '${process.cwd()}\\*' -DestinationPath '${zipName}' -Force"`;

    // Note: Compress-Archive is a bit annoying with deep node_modules, 
    // but since we are running in the bot dir, we should be careful.
    // Better: Just copy the essentials to a temp folder and zip that.

    if (fs.existsSync(folderName)) fs.rmSync(folderName, { recursive: true, force: true });
    fs.mkdirSync(folderName);

    filesToInclude.forEach(file => {
        const src = path.join(process.cwd(), file);
        if (fs.existsSync(src)) {
            const dest = path.join(folderName, file);
            if (fs.lstatSync(src).isDirectory()) {
                // simple deep copy for public folder
                execSync(`xcopy "${src}" "${dest}" /E /I /Y`);
            } else {
                fs.copyFileSync(src, dest);
            }
        }
    });

    // Zip the mobile folder
    execSync(`powershell -Command "Compress-Archive -Path '${folderName}\\*' -DestinationPath '${zipName}' -Force"`);

    console.log(`✅ Success! Please transfer '${zipName}' to your phone.`);
    console.log(`📂 Destination: /sdcard/Download/ (or any folder you prefer)`);

} catch (err) {
    console.error("❌ Error building mobile package:", err.message);
}
