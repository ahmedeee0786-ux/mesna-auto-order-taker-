const fs = require('fs');
const path = require('path');

class SheetsManager {
    constructor() {
        this.doc = null;
        this.GoogleSpreadsheet = null;
        this.JWT = null;
        this.currentSheetId = null;
    }

    async loadDeps() {
        if (!this.GoogleSpreadsheet) {
            const gs = await import("google-spreadsheet");
            this.GoogleSpreadsheet = gs.GoogleSpreadsheet;
            const auth = await import("google-auth-library");
            this.JWT = auth.JWT;
        }
    }

    async init() {
        try {
            await this.loadDeps();

            // Load latest sheet ID from config
            const configPath = path.join(__dirname, 'config.json');
            let sheetId = process.env.GOOGLE_SHEET_ID;
            if (fs.existsSync(configPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (config.sheetId) sheetId = config.sheetId;
                } catch (e) { }
            }

            // Skip if already initialized with SAME ID
            if (this.doc && this.currentSheetId === sheetId) return;

            console.log(`[SHEETS] Attempting to connect to ID: ${sheetId}`);
            this.currentSheetId = sheetId;

            let credentials;
            let credSource = "";
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                credSource = "Environment Variable";
            } else {
                const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || './service-account.json';
                if (!fs.existsSync(credPath)) {
                    console.log("⚠️ [SHEETS] service-account.json not found AND no GOOGLE_SERVICE_ACCOUNT_JSON env var detected.");
                    console.log("👉 PROMPT: Please add the 'GOOGLE_SERVICE_ACCOUNT_JSON' Variable in Railway and paste your JSON content there.");
                    return;
                }
                credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
                credSource = `File: ${credPath}`;
            }
            console.log(`[SHEETS] Using Service Account: ${credentials.client_email} (Source: ${credSource})`);
            const privateKey = credentials.private_key.replace(/\\n/g, '\n');

            const auth = new this.JWT({
                email: credentials.client_email,
                key: privateKey,
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });

            this.doc = new this.GoogleSpreadsheet(sheetId, auth);
            await this.doc.loadInfo();
            console.log(`✅ [SHEETS] Connected! Title: "${this.doc.title}"`);
        } catch (error) {
            console.error("❌ [SHEETS] Initialization Error:", error.message);
            this.doc = null;
        }
    }

    async getMenu() {
        try {
            await this.init();
            if (!this.doc) return null;
            const sheet = this.doc.sheetsByTitle["Menu"];
            if (!sheet) {
                console.log("No 'Menu' tab found. Using local config.");
                return null;
            }
            const rows = await sheet.getRows();
            const menu = {};
            rows.forEach(row => {
                const category = row.get("Category");
                const item = row.get("Item");
                const price = row.get("Price");

                if (category && item && price) {
                    if (!menu[category]) menu[category] = [];
                    menu[category].push({ item, price });
                }
            });
            return menu;
        } catch (error) {
            console.error("Error fetching menu from sheet:", error);
            return null;
        }
    }

    async updateMenu(menuData) {
        try {
            await this.init();
            if (!this.doc) return false;
            let sheet = this.doc.sheetsByTitle["Menu"];

            if (!sheet) {
                sheet = await this.doc.addSheet({
                    title: "Menu",
                    headerValues: ["Category", "Item", "Price"]
                });
            } else {
                await sheet.clearRows();
            }

            const rowsToAdd = [];
            for (const category in menuData) {
                menuData[category].forEach(itemObj => {
                    rowsToAdd.push({
                        "Category": category,
                        "Item": itemObj.item,
                        "Price": itemObj.price
                    });
                });
            }

            if (rowsToAdd.length > 0) {
                await sheet.addRows(rowsToAdd);
            }
            console.log("Sheet Menu updated successfully!");
            return true;
        } catch (error) {
            console.error("Error updating menu in sheet:", error);
            return false;
        }
    }

    async addOrder(data) {
        try {
            await this.init();
            if (!this.doc) {
                console.log("⚠️ [SHEETS] Google Sheets not connected. Check service account permissions.");
                return false;
            }

            // Try to find "Sheet1" by title first, fallback to index 0
            let sheet = this.doc.sheetsByTitle["Sheet1"] || this.doc.sheetsByIndex[0];

            if (!sheet) {
                console.error("❌ [SHEETS] No sheet found in the document!");
                return false;
            }

            console.log(`[SHEETS] Using tab: "${sheet.title}"`);

            try {
                await sheet.loadHeaderRow();
                console.log(`[SHEETS] Current headers: ${sheet.headerValues.join(", ")}`);
            } catch (e) {
                console.log("⚠️ [SHEETS] loadHeaderRow failed or empty. Setting new headers...");
                await sheet.setHeaderRow(["Timestamp", "Name", "Phone", "Address", "Order", "Status"]);
            }

            console.log(`[SHEETS] Adding row for ${data.name}...`);
            await sheet.addRow({
                Timestamp: new Date().toLocaleString(),
                Name: data.name,
                Phone: data.phone,
                Address: data.address,
                Order: data.order,
                Status: data.status || "Pending"
            });
            console.log("✅ [SHEETS] Row added successfully.");
            return true;
        } catch (error) {
            console.error("❌ [SHEETS] addOrder Error:", error.message);
            if (error.message.includes("does not have permission")) {
                console.error("👉 PROMPT: Did you share the Google Sheet with the Service Account email?");
            }
            return false;
        }
    }
}

module.exports = new SheetsManager();
