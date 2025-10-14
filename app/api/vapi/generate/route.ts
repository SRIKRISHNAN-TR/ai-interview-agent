import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ✅ Destructure with safe defaults
    const {
      type = "technical",
      role = "developer",
      level = "junior",
      techstack = "",
      amount = "5",
      userid = "",
    } = body;

    // ✅ Defensive fallback for malformed inputs
    if (!userid || !role) {
      return Response.json(
        { success: false, error: "Missing required fields (userid or role)" },
        { status: 400 }
      );
    }

    // ✅ Ask Gemini to generate interview questions
    const { text: questions } = await generateText({
      model: google("gemini-2.0-flash-001"),
      prompt: `
        Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack || "general"}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
      `,
    });

    // ✅ Safe parse: handle invalid or unexpected LLM output
    let parsedQuestions: string[] = [];
    try {
      const parsed = JSON.parse(questions);
      parsedQuestions = Array.isArray(parsed) ? parsed : [questions];
    } catch {
      parsedQuestions = [questions];
    }

    // ✅ Construct interview document
    const interview = {
      role,
      type,
      level,
      techstack: techstack ? techstack.split(",") : [],
      questions: parsedQuestions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    // ✅ Save to Firestore
    await db.collection("interviews").add(interview);

    return Response.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error in /api/vapi/generate:", error);

    let message = "Unknown error";
    if (error instanceof Error) message = error.message;
    else if (typeof error === "string") message = error;

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json(
    { success: true, data: "Interview generation endpoint active ✅" },
    { status: 200 }
  );
}
