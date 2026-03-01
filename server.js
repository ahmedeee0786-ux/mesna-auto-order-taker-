const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

function startDashboard(port = 3000) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });

    app.use(express.static(path.join(__dirname, 'public')));

    io.on('connection', (socket) => {
        console.log('Dashboard connected');

        // Send current settings to pre-fill the form
        try {
            const configPath = path.join(__dirname, 'config.json');
            let serviceEmail = "Not Found";

            // Extract email from service account JSON
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                try {
                    serviceEmail = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email;
                } catch (e) { }
            } else {
                const credPath = path.join(__dirname, 'service-account.json');
                if (fs.existsSync(credPath)) {
                    serviceEmail = JSON.parse(fs.readFileSync(credPath, 'utf8')).client_email;
                }
            }

            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

                // Fallback for email if not found in env/local file
                if (serviceEmail === "Not Found" && config.serviceEmail) {
                    serviceEmail = config.serviceEmail;
                }

                socket.emit('settings', {
                    name: config.restaurantName,
                    adminPhone: config.adminPhone,
                    deliveryCharges: config.deliveryCharges,
                    minDeliveryOrder: config.minDeliveryOrder,
                    sheetId: config.sheetId,
                    serviceEmail: serviceEmail
                });
            }
        } catch (e) {
            console.error("Error sending settings to dashboard:", e);
        }

        socket.on('save-settings', (data) => {
            try {
                console.log('Saving settings request received:', data);

                // Extract Google Sheet ID if it's a URL
                let sheetId = data.sheetId;
                if (sheetId && sheetId.includes('/d/')) {
                    const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
                    if (match && match[1]) {
                        sheetId = match[1];
                        console.log('Extracted Sheet ID:', sheetId);
                    }
                }

                // Update .env for API Key ONLY if .env exists and key is provided
                if (data.key) {
                    const envPath = path.join(__dirname, '.env');
                    if (fs.existsSync(envPath)) {
                        let envContent = fs.readFileSync(envPath, 'utf8');
                        if (envContent.includes('AI_API_KEY=')) {
                            envContent = envContent.replace(/AI_API_KEY=.*/, `AI_API_KEY=${data.key}`);
                        } else {
                            envContent += `\nAI_API_KEY=${data.key}`;
                        }
                        fs.writeFileSync(envPath, envContent);
                        console.log('.env updated with new API key');
                    } else {
                        // If no .env, we just let it be (Railway uses env vars directly)
                        console.log('Skipping .env update: file not found (Standard for Railway)');
                    }
                }

                // Update config.json for Restaurant Name and Policies
                const configPath = path.join(__dirname, 'config.json');
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (data.name !== undefined) config.restaurantName = data.name;
                    if (data.deliveryCharges !== undefined) config.deliveryCharges = parseInt(data.deliveryCharges) || 0;
                    if (data.minDeliveryOrder !== undefined) config.minDeliveryOrder = parseInt(data.minDeliveryOrder) || 0;
                    if (data.adminPhone !== undefined) config.adminPhone = data.adminPhone;
                    if (data.key) config.apiKey = data.key; // Store API Key in config as fallback for Railway
                    if (sheetId) config.sheetId = sheetId;

                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    console.log('config.json updated successfully');
                    socket.emit('settings-saved', { success: true, sheetId: sheetId });
                } else {
                    console.error('config.json not found!');
                    socket.emit('settings-saved', { success: false, error: 'config.json missing' });
                }
            } catch (err) {
                console.error('CRITICAL ERROR saving settings:', err);
                socket.emit('settings-saved', { success: false, error: err.message });
            }
        });
    });

    server.listen(port, () => {
        console.log(`Mesna Dashboard is live at http://localhost:${port}`);
    });

    return io;
}

module.exports = startDashboard;
