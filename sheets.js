const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
require("dotenv").config();

class SheetsManager {
    constructor() {
        this.doc = null;
    }

    async init() {
        if (this.doc) return;
        try {
            const credentials = require(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH);
            // Fix private key if it has literal \n instead of newlines
            const privateKey = credentials.private_key.replace(/\\n/g, '\n');

            const auth = new JWT({
                email: credentials.client_email,
                key: privateKey,
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });

            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
            await this.doc.loadInfo();
            console.log(`Connected to Sheet: ${this.doc.title}`);
        } catch (error) {
            console.error("Error connecting to Google Sheets:", error);
            throw error;
        }
    }

    async getMenu() {
        try {
            await this.init();
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
            let sheet = this.doc.sheetsByTitle["Menu"];

            // Create "Menu" sheet if it doesn't exist
            if (!sheet) {
                sheet = await this.doc.addSheet({
                    title: "Menu",
                    headerValues: ["Category", "Item", "Price"]
                });
            } else {
                // Clear existing rows
                await sheet.clearRows();
            }

            // Prepare rows
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

            // Add new rows
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
            const sheet = this.doc.sheetsByIndex[0]; // Assuming first sheet

            // Check if headers exist
            try {
                await sheet.loadHeaderRow();
            } catch (e) {
                console.log("Sheet looks empty or has no headers. Setting headers...");
                await sheet.setHeaderRow(["Timestamp", "Name", "Phone", "Address", "Order", "Total"]);
            }

            await sheet.addRow({
                Timestamp: new Date().toLocaleString(),
                Name: data.name,
                Phone: data.phone,
                Address: data.address,
                Order: data.order,
                Total: data.total || "N/A"
            });
            console.log("Order added to Google Sheet successfully.");
            return true;
        } catch (error) {
            console.error("Error adding row to sheet:", error);
            return false;
        }
    }
}

module.exports = new SheetsManager();
