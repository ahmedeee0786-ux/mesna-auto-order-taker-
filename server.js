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

        socket.on('save-settings', (data) => {
            console.log('Saving settings:', data);

            // Update .env for API Key if provided
            if (data.key) {
                let envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
                envContent = envContent.replace(/AI_API_KEY=.*/, `AI_API_KEY=${data.key}`);
                fs.writeFileSync(path.join(__dirname, '.env'), envContent);
            }

            // Update config.json for Restaurant Name and Policies
            if (data.name || data.deliveryCharges || data.minDeliveryOrder || data.adminPhone) {
                const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
                if (data.name) config.restaurantName = data.name;
                if (data.deliveryCharges) config.deliveryCharges = parseInt(data.deliveryCharges);
                if (data.minDeliveryOrder) config.minDeliveryOrder = parseInt(data.minDeliveryOrder);
                if (data.adminPhone) config.adminPhone = data.adminPhone;

                fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
            }
        });
    });

    server.listen(port, () => {
        console.log(`Mesna Dashboard is live at http://localhost:${port}`);
    });

    return io;
}

module.exports = startDashboard;
