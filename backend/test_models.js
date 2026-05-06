import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const modelsToTest = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemma-4-26b-a4b-it"
];

async function run() {
  for (const model of modelsToTest) {
    try {
      console.log(`Trying ${model}...`);
      const m = genAI.getGenerativeModel({ model });
      const res = await m.generateContent("hello");
      console.log(`✅ Success with ${model}`);
      process.exit(0);
    } catch(e) {
      console.log(`❌ Failed with ${model}: ${e.message.split('\\n')[0].substring(0, 100)}...`);
    }
  }
}
run();
