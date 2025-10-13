"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

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
  createdAt: string;
  // ... other interview fields
};

type Feedback = {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  // ... other feedback fields
};

// -------------------- Feedback Creation --------------------
export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence) => `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001", {
        structuredOutputs: false,
      }),
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
      system:
        "You are a professional interviewer analyzing a mock interview.",
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
  return interviewDoc.exists ? (interviewDoc.data() as Interview) : null;
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
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

// Get latest finalized interviews (excluding the current user) without composite index
export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  // Fetch all finalized interviews
  const snapshot = await db
    .collection("interviews")
    .where("finalized", "==", true)
    .get();

  // Filter out current user's interviews and sort by createdAt descending
  const interviews = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((interview) => interview.userId !== userId)
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
      return bTime - aTime; // descending
    })
    .slice(0, limit); // limit results

  return interviews as Interview[];
}

// Get interviews by user ID without composite index
export async function getInterviewsByUserId(userId: string): Promise<Interview[] | null> {
  const snapshot = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .get();

  // Sort by createdAt descending in JS
  const interviews = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
      return bTime - aTime; // descending
    });

  return interviews as Interview[];
}
