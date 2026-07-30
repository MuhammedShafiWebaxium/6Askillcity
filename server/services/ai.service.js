import { GoogleGenerativeAI } from "@google/generative-ai";
import createError from "http-errors";

const getModel = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw createError(503, "AI features are not configured");
  }

  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    .getGenerativeModel({ model: "gemini-flash-latest" });
};

const extractJson = (text) => {
  const cleaned = text.replace(/```(?:json)?|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw createError(502, "AI returned an invalid response");
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw createError(502, "AI returned malformed JSON");
  }
};

export const generateJson = async ({ systemPrompt, payload }) => {
  try {
    const result = await getModel().generateContent([
      `${systemPrompt}\nReturn only one valid JSON object. Never include markdown.`,
      JSON.stringify(payload),
    ]);
    return extractJson(result.response.text());
  } catch (error) {
    // Preserve only errors deliberately created by this service. Provider
    // errors can contain URLs, quota metadata, and implementation details
    // that must never be returned to the client.
    if (error.expose && error.statusCode) throw error;
    if (error.status === 429 || error.statusCode === 429) {
      throw createError(
        429,
        "The AI request limit has been reached. Please try again shortly.",
      );
    }
    if (error.status === 401 || error.status === 403) {
      throw createError(503, "The AI service is not configured correctly");
    }
    throw createError(502, "The AI service is temporarily unavailable");
  }
};
