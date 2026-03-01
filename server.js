const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

function startDashboard(port = 3000) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

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
            console.log('Saving settings:', data);

            // Update .env for API Key if provided
            if (data.key) {
                let envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
                envContent = envContent.replace(/AI_API_KEY=.*/, `AI_API_KEY=${data.key}`);
                fs.writeFileSync(path.join(__dirname, '.env'), envContent);
            }

            // Update config.json for Restaurant Name and Policies
            if (data.name || data.deliveryCharges || data.minDeliveryOrder || data.adminPhone || data.sheetId) {
                const configPath = path.join(__dirname, 'config.json');
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (data.name) config.restaurantName = data.name;
                if (data.deliveryCharges) config.deliveryCharges = parseInt(data.deliveryCharges);
                if (data.minDeliveryOrder) config.minDeliveryOrder = parseInt(data.minDeliveryOrder);
                if (data.adminPhone) config.adminPhone = data.adminPhone;
                if (data.sheetId) config.sheetId = data.sheetId;

                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            }
        });
    });

    server.listen(port, () => {
        console.log(`Mesna Dashboard is live at http://localhost:${port}`);
    });

    return io;
}

module.exports = startDashboard;
