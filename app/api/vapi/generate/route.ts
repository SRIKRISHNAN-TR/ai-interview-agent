import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Be tolerant to Gemini-style or missing fields
    const {
      type = "Technical",
      role = "Software Engineer",
      level = "Mid",
      techstack = "JavaScript",
      amount = 5,
      userId = "anonymous",
    } = body || {};

    const { text: rawText } = await generateText({
      model: google("gemini-2.0-flash-001"),
      prompt: `
You are an interview question generator.
Return ONLY valid JSON.
Example:
{"questions":["Question 1","Question 2","Question 3"]}

Role: ${role}
Level: ${level}
Tech stack: ${techstack}
Focus type: ${type}
Count: ${amount}
      `,
    });

    console.log("🧠 RAW GEMINI OUTPUT:", rawText);

    // --- CLEANUP PHASE ---
    let cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const jsonStart = cleaned.indexOf("{");
    if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonEnd > 0 && jsonEnd < cleaned.length - 1)
      cleaned = cleaned.slice(0, jsonEnd + 1);

    // --- PARSING PHASE ---
    let parsedQuestions: string[] = [];

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.questions)) {
        parsedQuestions = parsed.questions;
      } else if (Array.isArray(parsed)) {
        parsedQuestions = parsed;
      }
    } catch (err) {
      console.warn("⚠ JSON parse failed, trying fallback...");
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsedQuestions = JSON.parse(match[0]);
        } catch (inner) {
          console.error("❌ Array parse also failed:", inner);
        }
      }
    }

    if (!parsedQuestions.length) {
      console.warn("⚠ Using default fallback questions");
      parsedQuestions = [
        "Tell me about yourself.",
        "What are your strengths?",
        "Describe a project you’re proud of.",
        "How do you approach problem-solving?",
        "Why are you interested in this role?",
      ];
    }

    // --- SAVE TO FIRESTORE ---
    const interviewDoc = {
      role,
      type,
      level,
      techstack:
        typeof techstack === "string"
          ? techstack.split(",").map((t) => t.trim())
          : Array.isArray(techstack)
          ? techstack
          : [],
      questions: parsedQuestions,
      userId,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      rawAiResponse: rawText,
    };

    const ref = await db.collection("interviews").add(interviewDoc);

    return NextResponse.json(
      { success: true, interviewId: ref.id, questions: parsedQuestions },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("🔥 FULL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: true, data: "Interview Generator API is working fine!" },
    { status: 200 }
  );
}
