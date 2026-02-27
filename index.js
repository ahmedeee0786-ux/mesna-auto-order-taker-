const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const qrImage = require("qrcode");
const fs = require("fs");
const path = require("path");
const ai = require("./ai");
const sheets = require("./sheets");
const config = require("./config.json");
require("dotenv").config();

console.log(`
╔══════════════════════════════════════╗
║     🍕 MESNA BOT v6.0               ║
║     AI WhatsApp Food Ordering        ║
║     github.com/Ahmad/mesna-bot       ║
╚══════════════════════════════════════╝
`);

// Cross-Platform Chromium Detection (Termux support)
const termuxPaths = [
    "/data/data/com.termux/files/usr/bin/chromium",
    "/data/data/com.termux/files/usr/bin/chromium-browser"
];
let executablePath = undefined;
for (const p of termuxPaths) {
    if (fs.existsSync(p)) {
        executablePath = p;
        console.log(`📱 Termux Chromium found at: ${executablePath}`);
        break;
    }
}

// Multi-Client Session Setup (v6.0)
const clientId = process.env.SESSION_ID || 'default-client';
const client = new Client({
    authStrategy: new LocalAuth({ clientId: clientId }),
    puppeteer: {
        headless: true, // Invisible window (required for Termux, good for background PC)
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote', '--single-process'],
        executablePath: executablePath
    }
});

const startDashboard = require("./server");
const port = process.env.PORT || 3000;
const io = startDashboard(port);

// --- Auto-QR Watchdog (v5.1) ---
let isReady = false;
let lastQR = null;

const qrWatchdog = setInterval(() => {
    if (!isReady && lastQR) {
        console.log("🔄 Auto-Refreshing QR for Dashboard (1 min pulse)...");
        qrImage.toDataURL(lastQR, (err, url) => {
            if (!err) io.emit('qr', url);
        });
    } else if (isReady) {
        clearInterval(qrWatchdog);
        console.log("✅ Watchdog cleared. Bot is active.");
    }
}, 60000); // 1 minute

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
    const sheetMenu = await sheets.getMenu();
    if (sheetMenu) {
        restaurantMenu = sheetMenu;
        console.log("Menu loaded from Google Sheets!");
    } else {
        console.log("Using local menu from config.json");
    }
}

client.on("qr", async (qr) => {
    lastQR = qr; // Store for watchdog
    console.log("QR Code received. Sending to dashboard...");

    // Convert QR to Data URL for the Dashboard
    qrImage.toDataURL(qr, (err, url) => {
        if (!err) {
            io.emit('qr', url);
        }
    });

    // Save QR code as image (fallback)
    qrImage.toFile("./qr.png", qr, (err) => {
        if (err) console.error("Error saving QR image:", err);
    });
});

client.on("ready", async () => {
    isReady = true; // Mark as logged in
    console.log("Mesna Bot is ready!");
    io.emit('ready'); // Notify Dashboard

    // Auto-Set Profile Picture (Branding Identity v3.1)
    try {
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            const media = MessageMedia.fromFilePath(logoPath);
            await client.setProfilePicture(media);
            console.log("WhatsApp Profile Picture updated to Mesna Logo.");
        } else {
            console.log("logo.jpg not found. Identity automation skipped.");
        }
    } catch (err) {
        console.error("Failed to set profile picture:", err);
    }

    await refreshMenu();
});

const processingUsers = new Set();

const handleMessage = async (msg) => {
    try {
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

                await sheets.addOrder({
                    name: orderData.name,
                    phone: orderData.phone || userId.split("@")[0],
                    address: orderData.address,
                    order: orderData.items
                });
                console.log("Successfully logged order to sheet.");

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
                        timestamp: new Date().toISOString()
                    });
                    fs.writeFileSync(localBackupPath, JSON.stringify(localOrders, null, 2));
                    console.log("Order backed up locally to orders.json");
                } catch (backupErr) {
                    console.error("Local backup failed:", backupErr);
                }

                // admin notification (v5.0)
                try {
                    const currentConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
                    if (currentConfig.adminPhone) {
                        const adminId = `${currentConfig.adminPhone}@c.us`;
                        const adminMsg = `🚨 *NEW ORDER RECEIVED!*\n\n*Customer:* ${orderData.name}\n*Phone:* ${orderData.phone}\n*Items:* ${orderData.items}\n*Total:* Rs. ${orderData.total || "N/A"}\n*Address:* ${orderData.address}\n\n_Check Google Sheets for full details._`;
                        await client.sendMessage(adminId, adminMsg);
                        console.log(`Admin notified at ${adminId}`);
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

        // Send Menu Image automatically if Menu is mentioned or if specifically requested
        const menuMentions = ["menu", "pizzas", "burgers", "zinger", "deals", "gabbar", "gabber"];
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

client.on("message", handleMessage);

client.initialize();
