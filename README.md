# 🍕 Mesna Bot v6.0

> AI-powered WhatsApp food ordering bot with real-time dashboard, Google Sheets integration, and multi-client support.

## ✨ Features

- 🤖 **AI Chatbot** - Friendly Roman Urdu conversation powered by GPT-4o / Gemini
- 📋 **Smart Menu** - Dynamic menu from Google Sheets with image support
- 🧾 **Auto Order Logging** - Orders saved to Google Sheets + local backup
- 🖥️ **Live Dashboard** - Real-time QR code display + order alerts at `localhost:3000`
- 👤 **Customer Memory** - Remembers names, addresses, and past orders
- 💰 **Auto Billing** - Calculates totals with delivery charges
- 📱 **Cross-Platform** - Works on Windows, Linux, and Android (Termux)
- 🔄 **Multi-Client** - Run multiple bot instances for different restaurants

## 📦 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/Ahmad/mesna-bot.git
cd mesna-bot
npm install
```

### 2. Configure
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

Required environment variables:
| Variable | Description |
|----------|-------------|
| `AI_API_KEY` | Your OpenAI / Bytez API key |
| `AI_PROVIDER` | `openai` or `gemini` |
| `AI_MODEL` | Model name (default: `gpt-4o`) |
| `GEMINI_API_KEY` | Google Gemini API key (if using Gemini) |

### 3. Google Sheets Setup
1. Create a Google Cloud project & enable Sheets API
2. Create a Service Account and download the JSON key
3. Save it as `service-account.json` in the project root
4. Share your Google Sheet with the service account email

### 4. Start the Bot
```bash
npm start
```
The dashboard will open at `http://localhost:3000`. Scan the QR code with WhatsApp to connect.

## 📁 Project Structure

```
mesna-bot/
├── index.js          # Main bot entry point
├── ai.js             # AI conversation engine (GPT-4o / Gemini)
├── sheets.js         # Google Sheets integration
├── server.js         # Express dashboard server
├── config.json       # Restaurant menu & settings
├── public/
│   └── index.html    # Dashboard UI
├── .env.example      # Environment template
├── package.json      # Dependencies
└── README.md         # This file
```

## 📱 Android (Termux) Deployment

```bash
# Install dependencies
pkg install nodejs chromium -y

# Clone and install
git clone https://github.com/Ahmad/mesna-bot.git
cd mesna-bot
npm install

# Start
npm start
```

## 🔄 Multi-Client Mode

Run multiple bot instances for different restaurants:
```bash
# Instance 1 (Port 3000)
SESSION_ID=restaurant-1 PORT=3000 npm start

# Instance 2 (Port 3001)
SESSION_ID=restaurant-2 PORT=3001 npm start
```

## 🛠️ Configuration

Edit `config.json` to customize:
- Restaurant name
- Menu items & prices
- Delivery charges
- Minimum order amount
- Admin phone for notifications

## 📄 License

MIT
