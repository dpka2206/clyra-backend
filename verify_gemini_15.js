import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function verifyGemini15() {
    console.log("Verifying Gemini 1.5 Flash API Key...");
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, are you working?");
        console.log("Gemini 1.5 Response:", result.response.text());
    } catch (error) {
        console.error("Gemini 1.5 Error:", error.message);
    }
}

verifyGemini15();
