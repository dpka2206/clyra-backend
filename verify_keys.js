import { GoogleGenerativeAI } from "@google/generative-ai";
import { SarvamAIClient } from "sarvamai";
import dotenv from "dotenv";
import path from "path";

// Load .env from the current directory (assuming we run from backend/)
dotenv.config();

async function verifyKeys() {
    console.log("Verifying Gemini API Key...");
    console.log("Key:", process.env.GEMINI_API_KEY ? (process.env.GEMINI_API_KEY.slice(0, 5) + "...") : "MISSING");
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, are you working?");
        console.log("Gemini Response:", result.response.text());
    } catch (error) {
        console.error("Gemini Error:", error.message);
    }

    console.log("\nVerifying Sarvam API Key...");
    console.log("Key:", process.env.SARVAM_API_KEY ? (process.env.SARVAM_API_KEY.slice(0, 5) + "...") : "MISSING");
    try {
        if (!process.env.SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is missing");
        const sarvam = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
        console.log("Sarvam client initialized successfully.");
    } catch (error) {
        console.error("Sarvam Error:", error.message);
    }
}

verifyKeys();
