const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const qrImage = require("qrcode");
const fs = require("fs");
const path = require("path");
const ai = require("./ai");
const sheets = require("./sheets");
const config = require("./config.json");
require("dotenv").config();

// --- Global State (v6.2) ---
let isReady = false;
let lastQR = null;
const processingUsers = new Set();
const processedMessages = new Map();

// --- Dashboard Setup ---
const startDashboard = require("./server");
const port = process.env.PORT || 3000;
const io = startDashboard(port);

// --- Error Hardening (v6.1) ---
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log(`
╔══════════════════════════════════════╗
║     🍕 MESNA BOT v6.0               ║
║     AI WhatsApp Food Ordering        ║
║     github.com/Ahmad/mesna-bot       ║
╚══════════════════════════════════════╝
`);

// Cross-Platform Chromium Detection (Cloud / Termux / Windows)
const { execSync } = require('child_process');

let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

if (!executablePath) {
    // Nixpacks fallback: chromium path includes a hash, use 'which' to find it
    try {
        executablePath = execSync('which chromium').toString().trim();
        if (executablePath) {
            console.log(`Found chromium via 'which': ${executablePath}`);
        }
    } catch (e) {
        // Not found via which
        console.log("Chromium not found via 'which' command.");
    }

    if (!executablePath) {
        const chromiumPaths = [
            "/usr/bin/chromium",                                       // Linux / Docker
            "/usr/bin/chromium-browser",                               // Linux alt
            "/usr/bin/google-chrome-stable",                           // Linux Chrome
            "/data/data/com.termux/files/usr/bin/chromium",            // Termux
            "/data/data/com.termux/files/usr/bin/chromium-browser",    // Termux alt
        ];

        for (const p of chromiumPaths) {
            if (fs.existsSync(p)) {
                executablePath = p;
                break;
            }
        }
    }
}

if (executablePath) {
    console.log(`✅ Browser found at: ${executablePath}`);
} else {
    console.log("💻 No system browser found, using default Puppeteer Chromium (Windows/Mac)");
}


// Multi-Client Session Setup (v6.0)
const clientId = process.env.SESSION_ID || 'default-client';
let client;

try {
    client = new Client({
        authStrategy: new LocalAuth({ clientId: clientId }),
        puppeteer: {
            executablePath: executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    // Re-bind listeners after client creation
    client.on("qr", async (qr) => {
        lastQR = qr;
        console.log("QR Code received. Sending to dashboard...");
        qrImage.toDataURL(qr, (err, url) => {
            if (!err) io.emit('qr', url);
        });
        qrImage.toFile("./qr.png", qr, (err) => {
            if (err) console.error("Error saving QR image:", err);
        });
    });

    client.on("ready", async () => {
        isReady = true;
        console.log("Mesna Bot is ready!");
        io.emit('ready');
        try {
            const logoPath = path.join(__dirname, 'logo.jpg');
            if (fs.existsSync(logoPath)) {
                const media = MessageMedia.fromFilePath(logoPath);
                await client.setProfilePicture(media);
                console.log("WhatsApp Profile Picture updated.");
            }
        } catch (err) { }
        await refreshMenu();
    });

    client.on("message", handleMessage);

    client.initialize();

} catch (err) {
    console.error("❌ FAILED TO INITIALIZE WHATSAPP CLIENT:", err);
}

// --- Auto-QR Watchdog (v5.1) ---
const qrWatchdog = setInterval(() => {
    if (!isReady && lastQR) {
        console.log("🔄 Auto-Refreshing QR for Dashboard (20 sec pulse)...");
        qrImage.toDataURL(lastQR, (err, url) => {
            if (!err) io.emit('qr', url);
        });
    } else if (isReady) {
        clearInterval(qrWatchdog);
        console.log("✅ Watchdog cleared. Bot is active.");
    }
}, 20000); // Faster pulse

// --- Logout & State Sync Support (v5.2) ---
io.on('connection', (socket) => {
    console.log("🖥️ Dashboard connected. Syncing state...");

    // Send current state immediately to the new connection
    if (isReady) {
        socket.emit('ready');
    } else if (lastQR) {
        qrImage.toDataURL(lastQR, (err, url) => {
            if (!err) socket.emit('qr', url);
        });
    }

    socket.on('request-logout', async () => {
        console.log("🔴 Logout requested! Cleaning session...");
        try {
            await client.logout();
            console.log("✅ Session cleared. Bot will restart for new QR in 5 seconds.");
            process.exit(0); // Triggers the Auto-Restart Loop in .bat
        } catch (err) {
            console.error("Logout failed:", err);
            process.exit(1);
        }
    });
});

// Load menu dynamically
let restaurantMenu = config.menu;
async function refreshMenu() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            restaurantMenu = currentConfig.menu;
        }

        const sheetMenu = await sheets.getMenu();
        if (sheetMenu) {
            restaurantMenu = sheetMenu;
            console.log("Menu loaded from Google Sheets!");
        } else {
            console.log("Using local menu from config.json");
        }
    } catch (e) {
        console.error("Error refreshing menu:", e);
    }
}



// Moved processing states to global

const handleMessage = async (msg) => {
    try {
        const msgId = msg.id.id;
        if (processedMessages.has(msgId)) return;
        processedMessages.set(msgId, Date.now());

        await refreshMenu(); // Ensure we have latest menu/config for every message
        const contact = await msg.getContact();
        const userId = contact.id._serialized;

        // Don't reply to status updates or group messages (unless specified)
        if (msg.isStatus || msg.from.includes("@g.us")) return;

        // Prevent concurrent processing for the same user
        if (processingUsers.has(userId)) return;
        processingUsers.add(userId);

        console.log(`Message from ${userId}: ${msg.body}`);

        // Get AI response
        const aiResponse = await ai.getResponse(userId, msg.body, restaurantMenu);

        // Extract ORDER_DATA using Regex (Robust for multiline/formatting)
        let finalResponse = aiResponse;
        const orderMatch = aiResponse.match(/ORDER_DATA:\s*(\{[\s\S]*?\})/);

        if (orderMatch) {
            finalResponse = aiResponse.replace(/ORDER_DATA:\s*\{[\s\S]*?\}/, "").trim();
            const jsonStr = orderMatch[1].trim();

            try {
                const orderData = JSON.parse(jsonStr);
                console.log("Extracted Order Data:", orderData);

                // Save profile for future reference
                ai.saveProfile(userId, {
                    name: orderData.name,
                    address: orderData.address,
                    phone: orderData.phone,
                    lastOrder: orderData.items // Added lastOrder for Smart Memory
                });

                const sheetResult = await sheets.addOrder({
                    name: orderData.name,
                    phone: orderData.phone || userId.split("@")[0],
                    address: orderData.address,
                    order: `${orderData.items} (Total: Rs. ${orderData.total || "N/A"})`,
                    status: "Pending"
                });

                if (sheetResult) {
                    console.log("✅ Successfully logged order to Google Sheet.");
                } else {
                    console.log("❌ Failed to log order to Google Sheet. Check console for errors.");
                }

                // Local Backup (v2.3)
                try {
                    const localBackupPath = path.join(__dirname, 'orders.json');
                    let localOrders = [];
                    if (fs.existsSync(localBackupPath)) {
                        localOrders = JSON.parse(fs.readFileSync(localBackupPath, 'utf8'));
                    }
                    localOrders.push({
                        ...orderData,
                        userId: userId,
                        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })
                    });
                    fs.writeFileSync(localBackupPath, JSON.stringify(localOrders, null, 2));
                    console.log("Order backed up locally to orders.json");
                } catch (backupErr) {
                    console.error("Local backup failed:", backupErr);
                }

                // admin notification (v5.0)
                try {
                    const configPath = path.join(__dirname, 'config.json');
                    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

                    if (currentConfig.adminPhone) {
                        // Ensure phone is digits only for @c.us format
                        const cleanPhone = currentConfig.adminPhone.replace(/\D/g, '');
                        const adminId = `${cleanPhone}@c.us`;

                        const adminMsg = `🚨 *NEW ORDER RECEIVED!*\n\n*Customer:* ${orderData.name}\n*Phone:* ${orderData.phone}\n*Items:* ${orderData.items}\n*Total:* Rs. ${orderData.total || "N/A"}\n*Address:* ${orderData.address}\n\n_Check Google Sheets for full details._`;

                        try {
                            await client.sendMessage(adminId, adminMsg);
                            console.log(`✅ Admin notified at ${adminId}`);
                        } catch (sendErr) {
                            console.error(`❌ client.sendMessage to Admin failed (${adminId}):`, sendErr.message);
                        }
                    }

                    // Dashboard Alert
                    io.emit('order-alert', {
                        name: orderData.name,
                        items: orderData.items,
                        total: orderData.total
                    });
                } catch (adminErr) {
                    console.error("Admin notification failed:", adminErr);
                }

                // Keep session history to handle "thanks/ok" naturally, but limit size to 10 to prevent bloat
                if (ai.sessions.has(userId)) {
                    const session = ai.sessions.get(userId);
                    if (session.history.length > 10) {
                        session.history = session.history.slice(-10);
                    }
                }
                console.log(`Session preserved for ${userId} to handle post-order follow-up.`);
            } catch (err) {
                console.error("Failed to parse order JSON:", err);
            }
        }

        // Send cleaned response back
        await client.sendMessage(msg.from, finalResponse);

        // Send Menu Image automatically if specifically requested
        const mediaKeywords = ["pic", "photo", "tasveer", "picture"];

        const shouldSendImage =
            mediaKeywords.some(k => msg.body.toLowerCase().includes(k)) ||
            (finalResponse.toLowerCase().includes("menu") && !aiResponse.includes("confirm"));

        if (shouldSendImage) {
            const menuFiles = fs.readdirSync(__dirname).filter(file => file.startsWith('menu') && (file.endsWith('.jpg') || file.endsWith('.png')));

            for (const file of menuFiles) {
                const mediaPath = path.join(__dirname, file);
                const media = MessageMedia.fromFilePath(mediaPath);
                await client.sendMessage(msg.from, media);
                console.log(`Sent menu image (${file}) to user.`);
            }
        }

        processingUsers.delete(userId);
    } catch (error) {
        console.error("Error handling message:", error);
        processingUsers.delete(userId);
    }
};

