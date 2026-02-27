# 🚀 Mesna Bot: Reseller & Setup Guide

This guide explains how to prepare and sell this bot to a new restaurant owner effortlessly.

## 📦 How to Prepare for Delivery (Easy Way)
Instead of deleting files manually, just do this:
1.  Open your bot folder.
2.  In the terminal, run: `node PREPARE_FOR_SALE.js`
3.  A new folder named `MESNA_BOT_DELIVERY` will be created **outside** your current folder.
4.  **Zip** that new folder and send it to your client. 

This script automatically removes your private WhatsApp logins, orders, and API keys so your data is safe! ✅

---

## 🛠️ Step-by-Step Setup for New Owner

### 1. Google Sheets (Order Logging)
1. Tell the owner to create a new Google Sheet.
2. They need to create a **Google Service Account** and download the `JSON` key.
3. Rename that key to `service-account.json` and put it in the bot folder.
4. **Important**: Share the Google Sheet with the email found inside the JSON key (client-email).

### 2. API Keys (.env file)
Create a new `.env` file for them with this structure:
```bash
AI_API_KEY=Their_Bytez_API_Key
AI_PROVIDER=openai
AI_BASE_URL=https://api.bytez.com/v1
AI_MODEL=openai/gpt-4o-mini
GEMINI_API_KEY=Their_Gemini_API_Key
GOOGLE_SHEET_ID=Their_New_Sheet_ID
```

### 3. Menu Customization
1. **The Image**: Replace `menu.jpg` with a clear photo of their physical menu.
2. **The Logic**: 
   - Open `sync_menu.js`.
   - Run `node sync_menu.js` in the terminal.
   - The bot will automatically read the photo and save the menu into `config.json`.

### 4. Running the Bot
1. Open terminal in the folder.
2. Run `npm install`.
3. Run `node index.js`.
4. Scan the QR code with the restaurant's WhatsApp phone.

---

## 💰 Pro Tip for Selling
Tell them: *"This bot never forgets a customer. It remembers their name, address, and what they ate last time, making them feel like a VIP every time they message."*
