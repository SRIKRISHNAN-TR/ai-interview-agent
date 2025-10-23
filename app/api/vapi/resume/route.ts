import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    // Read resume as text (Gemini will handle resume parsing)
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Resume = buffer.toString("base64");

    const { text: rawText } = await generateText({
      model: google("gemini-2.0-flash-001"),
      prompt: `
You are an AI interviewer analyzing a candidate's resume.
The following is a Base64-encoded PDF resume:
${base64Resume}

1️⃣ Read and extract useful information (skills, education, experience, projects).
2️⃣ Then generate 8–10 **interview questions** based specifically on the resume content.
3️⃣ Also, write **3–5 short improvement suggestions** to enhance the resume clarity or impact.
4️⃣ Return ONLY valid JSON.

Example:
{
  "questions": [
    "What challenges did you face in your XYZ project?",
    "Can you explain how you optimized database queries?"
  ],
  "resume_improvements": [
    "Add measurable outcomes to your project descriptions",
    "Include your LinkedIn or GitHub profile link"
  ]
}
`,
    });

    console.log("🧠 RAW GEMINI OUTPUT:", rawText);

    let cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const jsonStart = cleaned.indexOf("{");
    if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonEnd > 0 && jsonEnd < cleaned.length - 1)
      cleaned = cleaned.slice(0, jsonEnd + 1);

    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.warn("⚠ Failed to parse Gemini JSON, using fallback", err);
    }

    const questions = parsed.questions || [
      "Tell me about your recent project.",
      "What are your primary technical skills?",
      "What is your proudest achievement?",
    ];

    const resumeImprovements = parsed.resume_improvements || [
      "Add more measurable results to your work experience.",
      "Include certifications or relevant links.",
    ];

    // Save to Firestore
    const doc = {
      userId,
      type: "resume-based",
      questions,
      resumeImprovements,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      rawAiResponse: rawText,
    };

    const ref = await db.collection("interviews").add(doc);

    return NextResponse.json(
      { success: true, interviewId: ref.id, questions, resumeImprovements },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("🔥 Resume parsing error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
