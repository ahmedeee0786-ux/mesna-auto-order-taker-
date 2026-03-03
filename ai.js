const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
require("dotenv").config();
const fs = require('fs');
const path = require('path');

const config = require("./config.json");

class MesnaAI {
  constructor(apiKey, provider) {
    const configPath = path.join(__dirname, 'config.json');
    let dynamicConfig = {};
    if (fs.existsSync(configPath)) {
      try { dynamicConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { }
    }

    this.provider = provider || process.env.AI_PROVIDER || "openai";
    this.apiKey = dynamicConfig.apiKey || apiKey || process.env.AI_API_KEY;
    this.restaurantName = dynamicConfig.restaurantName || "Janan Cafe";

    this.sessions = new Map();
    this.profilesPath = path.join(__dirname, 'profiles.json');
    this.userProfiles = this.loadProfiles();

    if (this.provider === "gemini") {
      const genKey = process.env.GEMINI_API_KEY || this.apiKey;
      const genAI = new GoogleGenerativeAI(genKey);
      this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    } else {
      const baseURL = process.env.AI_BASE_URL || "https://api.bytez.com/v1";
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        baseURL: baseURL,
        timeout: 20000
      });
    }
  }

  loadProfiles() {
    try {
      if (fs.existsSync(this.profilesPath)) {
        return JSON.parse(fs.readFileSync(this.profilesPath, 'utf8'));
      }
    } catch (e) {
      console.error("Error loading profiles:", e);
    }
    return {};
  }

  saveProfile(userId, data) {
    this.userProfiles[userId] = {
      ...this.userProfiles[userId],
      ...data,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(this.profilesPath, JSON.stringify(this.userProfiles, null, 2));
  }

  async analyzeMenuImage(imagePath) {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error("Menu image not found at " + imagePath);
      }

      const imageData = fs.readFileSync(imagePath).toString('base64');
      console.log(`[Universal Vision Sync] Processing menu image...`);

      const prompt = `
        Analyze this restaurant menu image and extract all food items, categories, and prices.
        Return ONLY a clean JSON object in this format:
        {
          "CategoryName": [
            { "item": "Food Name", "price": "Price" }
          ]
        }
      `;

      // Using Fetch for maximum stability across different environments/keys
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY || this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: imageData } }
            ]
          }]
        })
      });

      const data = await response.json();
      if (!data.candidates || !data.candidates[0].content.parts[0].text) {
        throw new Error("Invalid API Response: " + JSON.stringify(data));
      }

      let responseText = data.candidates[0].content.parts[0].text;
      responseText = responseText.replace(/```json|```/g, "").trim();
      return JSON.parse(responseText);
    } catch (error) {
      console.error("Universal Vision Error:", error.message);
      return null;
    }
  }

  async getResponse(userId, message, currentMenu = null) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, { history: [] });
    }
    const session = this.sessions.get(userId);
    const profile = this.userProfiles[userId] || {};

    // Load latest config for dynamic naming/policies
    let currentConfig = config;
    try {
      const configPath = path.join(__dirname, 'config.json');
      if (fs.existsSync(configPath)) {
        currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) { }

    const menuToUse = currentMenu || currentConfig.menu;
    const restaurantName = currentConfig.restaurantName || "Janan Cafe";
    const minOrder = currentConfig.minDeliveryOrder || 0;
    const deliveryFee = currentConfig.deliveryCharges || 150;

    const systemPrompt = `
      You are "Mesna", a professional and efficient AI waiter for "${restaurantName}".
      Your primary goal is to take food orders quickly and accurately.
      
      CUSTOMER PROFILE (IF KNOWN):
      Name: ${profile.name || "Unknown"}
      Address: ${profile.address || "Unknown"}
      Phone: ${profile.phone || userId.split("@")[0]}
      Last Order: ${profile.lastOrder || "None"}
      Restaurant: ${restaurantName}

      RULES:
      1. Talk in Roman Urdu (Urdu written in English script).
      2. Be polite but focus on the order. Do not talk too much. 
      3. SMART MEMORY & IDENTITY (CRITICAL):
         - You are Mesna from "${restaurantName}".
         - Every initial greeting MUST include your name and "${restaurantName}".
         - IF NAME IS KNOWN: Say "Assalamu Alaikum [Name]! Main Mesna hoon ${restaurantName} se. Kaise hain aap?". Then ask if they want their "Last Order" or something new.
         - IF NAME IS NOT KNOWN: Say "Assalamu Alaikum! Main Mesna hoon ${restaurantName} se. Order start karne ke liye, kya aap mujhe apna "name", "address" aur "phone number" bata sakte hain?".
         - ADDRESS VERIFICATION: If you already have an "address" in the CUSTOMER PROFILE, DO NOT ask "what is your address?". Instead, when they start ordering, ask: "Aapka delivery address abhi bhi [Address] hi hai na?".
      4. FORMATTING RULE: Whenever you ask for or mention "name", "address", or "phone number", you MUST wrap them in double quotes like this: "name", "address", "phone number".
      5. If the customer asks for a "pic", "photo", or "tasveer" of the menu, say "Ji bilkul, main aapko ${restaurantName} ka menu bhej rahi hoon, niche dekhein".
      6. Focus on ${restaurantName} items and deals.
      7. DELIVERY POLICIES:
         - Minimum Order for Home Delivery: Rs. ${minOrder}.
         - Delivery Charges: Rs. ${deliveryFee}.
         - If Min Order is greater than 0 and the total bill is LESS than it, tell the customer: "Ghar par delivery ke liye kam se kam Rs. ${minOrder} ka order hona zaroori hai. Kya aap kuch aur add karna chahen ge?".
         - ALWAYS add delivery charges to the total bill carefully if they are opted for home delivery.
      8. ORDERING STEPS (STRICT):
         - Step 1 (Skip if known): Get "name", "address", and "phone number".
         - Step 2 (Address Check): If you have a saved address, confirm it: "Aap ka order [Address] par hi bhejun?". If they say "Yes" or "Ji", proceed. If they give a NEW address, update your knowledge.
         - Step 3: Fast Ordering - After they select an item, ask "Aur kuch?" or "Deal finalize karun?".
         - Step 4: Final Bill - Provide a clear BILL SUMMARY and ask for FINAL confirmation.
         - Step 5: If confirmed, end with the ORDER_DATA tag.
      
      9. POST-ORDER:
         - After confirmation, if they say "thanks/shukriya/ok", just reply "Bohat shukriya!" and stop. Do not start a new order.
      
      FINAL STEP (CRITICAL):
      ONLY when the customer gives the FINAL approval, append exactly this tag:
      ORDER_DATA: {"name": "REAL_NAME", "phone": "REAL_PHONE", "address": "REAL_ADDRESS", "items": "ITEMS_SUMMARY", "total": "TOTAL_PRICE"}
      
      RESTAURANT MENU:
      ${JSON.stringify(menuToUse, null, 2)}
    `;

    let aiResponse = "";

    try {
      console.log(`[AI Request] User: ${userId}, Provider: ${this.provider}, Message: ${message}`);
      if (this.provider === "gemini") {
        const chat = this.model.startChat({
          history: session.history,
          systemInstruction: { parts: [{ text: systemPrompt }] },
        });

        const result = await chat.sendMessage(message);
        aiResponse = result.response.text();

        session.history.push({ role: "user", parts: [{ text: message }] });
        // Strip ORDER_DATA from history to prevent re-triggering
        const cleanGeminiResponse = aiResponse.split("ORDER_DATA:")[0].trim();
        session.history.push({ role: "model", parts: [{ text: cleanGeminiResponse }] });
      } else {
        console.log("History Length:", session.history.length);
        const response = await this.openai.chat.completions.create({
          model: process.env.AI_MODEL || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            ...session.history,
            { role: "user", content: message },
          ],
        });

        if (!response.choices || response.choices.length === 0) {
          throw new Error("Empty response from AI Provider");
        }

        aiResponse = response.choices[0].message.content;
        console.log(`[AI Response] Successfully got content (${aiResponse.length} chars)`);
        session.history.push({ role: "user", content: message });
        // Strip ORDER_DATA from history to prevent re-triggering
        const cleanHistoryResponse = aiResponse.split("ORDER_DATA:")[0].trim();
        session.history.push({ role: "assistant", content: cleanHistoryResponse });
      }
    } catch (error) {
      console.error("AI Generation Error Details:", error);
      aiResponse = "Maaf kijiyega, system mein thora masla aa gaya hai. Kya aap phir se koshish kar sakte hain?";
    }

    return aiResponse;
  }
}

module.exports = new MesnaAI(process.env.AI_API_KEY, process.env.AI_PROVIDER);
