"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

// -------------------- Types --------------------
type CreateFeedbackParams = {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
};

type GetFeedbackByInterviewIdParams = {
  interviewId: string;
  userId: string;
};

type GetLatestInterviewsParams = {
  userId: string;
  limit?: number;
};

// Firestore Timestamp compatible type
type FirestoreTimestamp = {
  toMillis?: () => number;
};

// ✅ Updated Interview type with all the fields your UI uses
type Interview = {
  id: string;
  userId: string;
  finalized: boolean;
  role: string;
  type: string;
  techstack: string;
  createdAt?: FirestoreTimestamp | string | null;
};

type Feedback = {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores?: Record<string, number>;
  strengths?: string[];
  areasForImprovement?: string[];
  finalAssessment?: string;
  createdAt?: string;
};

// -------------------- Helper --------------------
function getTimeValue(createdAt: any): number {
  if (!createdAt) return 0;

  if (typeof createdAt === "object" && createdAt !== null && typeof createdAt.toMillis === "function") {
    try {
      return createdAt.toMillis();
    } catch {
      return 0;
    }
  }

  if (typeof createdAt === "string" || createdAt instanceof Date) {
    const t = new Date(createdAt).getTime();
    return isNaN(t) ? 0 : t;
  }

  return 0;
}

// -------------------- Feedback Creation --------------------
export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map((sentence) => `- ${sentence.role}: ${sentence.content}\n`)
      .join("");

    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001", { structuredOutputs: false }),
      schema: feedbackSchema,
      prompt: `
        You are an AI interviewer analyzing a mock interview. Evaluate the candidate thoroughly.

        Transcript:
        ${formattedTranscript}

        Score from 0 to 100 in:
        - Communication Skills
        - Technical Knowledge
        - Problem-Solving
        - Cultural & Role Fit
        - Confidence & Clarity
      `,
      system: "You are a professional interviewer analyzing a mock interview.",
    });

    const feedback = {
      interviewId,
      userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    await feedbackRef.set(feedback);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

// -------------------- Firestore Read Operations --------------------

// Get a single interview by ID
export async function getInterviewById(id: string): Promise<Interview | null> {
  const interviewDoc = await db.collection("interviews").doc(id).get();
  if (!interviewDoc.exists) return null;

  const data = interviewDoc.data() || {};
  return { id: interviewDoc.id, ...(data as Omit<Interview, "id">) };
}

// Get feedback by interview ID and user ID
export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...(feedbackDoc.data() as Omit<Feedback, "id">) };
}

// Get latest finalized interviews (excluding the current user)
export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  const snapshot = await db
    .collection("interviews")
    .where("finalized", "==", true)
    .get();

  const interviews = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Interview, "id">) }))
    .filter((interview) => interview.userId !== userId)
    .sort((a, b) => getTimeValue(b.createdAt) - getTimeValue(a.createdAt))
    .slice(0, limit);

  return interviews;
}

// Get interviews by user ID
export async function getInterviewsByUserId(userId: string): Promise<Interview[] | null> {
  const snapshot = await db.collection("interviews").where("userId", "==", userId).get();

  const interviews = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Interview, "id">) }))
    .sort((a, b) => getTimeValue(b.createdAt) - getTimeValue(a.createdAt));

  return interviews;
}
