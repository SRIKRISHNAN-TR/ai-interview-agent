"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import type { Timestamp } from "firebase-admin/firestore";

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

type Interview = {
  id: string;
  userId: string;
  finalized: boolean;
  createdAt?: string | Timestamp;
  // ... other interview fields
};

type Feedback = {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores?: any;
  strengths?: string;
  areasForImprovement?: string;
  finalAssessment?: string;
  createdAt?: string | Timestamp;
};

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
        Score from 0 to 100 in the categories:
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
      createdAt: new Date(), // store as JS Date (can also use serverTimestamp)
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
  return interviewDoc.exists ? ({ id: interviewDoc.id, ...interviewDoc.data() } as Interview) : null;
}

// Get feedback by interview ID and user ID
export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const snapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Feedback;
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
    .map((doc) => ({ id: doc.id, ...doc.data() } as Interview))
    .filter((interview) => interview.userId !== userId)
    .sort((a, b) => {
      const aTime = a.createdAt && "toMillis" in a.createdAt
        ? a.createdAt.toMillis()
        : a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;
      const bTime = b.createdAt && "toMillis" in b.createdAt
        ? b.createdAt.toMillis()
        : b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;
      return bTime - aTime; // descending
    })
    .slice(0, limit);

  return interviews;
}

// Get interviews by user ID
export async function getInterviewsByUserId(userId: string): Promise<Interview[] | null> {
  const snapshot = await db.collection("interviews").where("userId", "==", userId).get();

  const interviews = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        finalized: data.finalized,
        createdAt: data.createdAt, // Timestamp or string
      } as Interview;
    })
    .sort((a, b) => {
      const aTime =
        a.createdAt && "toMillis" in a.createdAt
          ? a.createdAt.toMillis()
          : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
      const bTime =
        b.createdAt && "toMillis" in b.createdAt
          ? b.createdAt.toMillis()
          : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
      return bTime - aTime;
    });

  return interviews;
}
