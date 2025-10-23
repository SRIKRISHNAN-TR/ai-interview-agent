"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

interface AgentProps {
  userName: string;
  userId: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
}

const Agent = ({ userName, userId, interviewId, feedbackId, type, questions }: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [currentInterviewId, setCurrentInterviewId] = useState(interviewId);

  const [setup, setSetup] = useState({
    role: "",
    type: "",
    level: "",
    techstack: "",
    amount: 5,
  });

  // --- Vapi event handlers ---
  useEffect(() => {
    const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
    const onCallEnd = () => setCallStatus(CallStatus.FINISHED);

    const onMessage = (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const text = message.transcript?.trim() || "";
        setMessages((prev) => [...prev, { role: message.role, content: text }]);

        if (type === "generate" && message.role === "user") detectSetupAnswers(text);
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);
    const onError = (error: any) => console.error("Vapi error:", error);

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, [type]);

  // --- Detect setup answers dynamically ---
  const detectSetupAnswers = (text: string) => {
    const lower = text.toLowerCase();
    const updates: Partial<typeof setup> = {};

    if (lower.includes("developer") || lower.includes("engineer")) updates.role = text;
    if (lower.includes("technical") || lower.includes("hr")) updates.type = text;
    if (lower.includes("junior") || lower.includes("mid") || lower.includes("senior")) updates.level = text;
    if (lower.includes("react") || lower.includes("python") || lower.includes("java")) updates.techstack = text;

    const numberMatch = text.match(/\b\d+\b/);
    if (numberMatch) updates.amount = parseInt(numberMatch[0], 10);

    if (Object.keys(updates).length > 0) setSetup((prev) => ({ ...prev, ...updates }));
  };

  // --- Handle feedback generation ---
  useEffect(() => {
    if (messages.length > 0) setLastMessage(messages[messages.length - 1].content);

    const handleGenerateFeedback = async () => {
      if (!currentInterviewId) return;

      try {
        const payload: any = {
          interviewId: currentInterviewId,
          userId,
          transcript: messages || [],
        };
        if (feedbackId) payload.feedbackId = feedbackId;

        const { success, feedbackId: id } = await createFeedback(payload);

        if (success && id) router.push(`/interview/${currentInterviewId}/feedback`);
        else router.push("/");
      } catch (err) {
        console.error("Error generating feedback:", err);
      }
    };

    if (callStatus === CallStatus.FINISHED && type !== "generate") handleGenerateFeedback();
  }, [messages, callStatus, currentInterviewId, feedbackId, type, userId, router]);

  // --- Core call handler ---
  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);

    try {
      if (type === "generate") {
        await vapi.start(interviewer, {
          variableValues: {
            questions: `
Hi ${userName}! Before we begin, could you tell me:
1. What role are you interviewing for?
2. What type of interview (Technical / HR / Behavioral)?
3. What’s your experience level? (Junior / Mid / Senior)
4. What tech stack should I focus on?
5. How many questions would you like me to ask?`,
          },
        });

        setCallStatus(CallStatus.ACTIVE);
      } else {
        const formattedQuestions = (questions || []).map((q) => `- ${q}`).join("\n");
        await vapi.start(interviewer, { variableValues: { questions: formattedQuestions } });
        setCallStatus(CallStatus.ACTIVE);
      }
    } catch (err) {
      console.error("Start call error:", err);
      setCallStatus(CallStatus.INACTIVE);
    }
  };

  // --- Auto-generate questions when setup complete ---
  useEffect(() => {
    const { role, type, level, techstack, amount } = setup;
    if (role && type && level && techstack && amount) {
      console.log("🧠 Setup complete, generating interview questions...");
      generateQuestions();
    }
  }, [setup]);

  const generateQuestions = async () => {
    try {
      const res = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...setup, userId }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const { interviewId, questions: generatedQuestions } = data;
      if (!interviewId) throw new Error("No interviewId returned");

      setCurrentInterviewId(interviewId);

      const formattedQuestions = (generatedQuestions || []).map((q: string) => `- ${q}`).join("\n");

      await vapi.start(interviewer, { variableValues: { questions: formattedQuestions } });
    } catch (error) {
      console.error("⚠ Error generating questions:", error);
    }
  };

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image src="/ai-avatar.png" alt="profile-image" width={65} height={54} className="object-cover" />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={120}
              height={120}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p key={lastMessage} className={cn("transition-opacity duration-500 opacity-0", "animate-fadeIn opacity-100")}>
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center gap-4">
        {callStatus !== CallStatus.ACTIVE ? (
          <button className="relative btn-call" onClick={handleCall} disabled={callStatus === CallStatus.CONNECTING}>
            <span className={cn("absolute animate-ping rounded-full opacity-75", callStatus !== CallStatus.CONNECTING && "hidden")} />
            <span className="relative">
              {callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED ? "Start Interview" : ". . . Connecting"}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleDisconnect}>
            End Interview
          </button>
        )}

        <label htmlFor="resume-upload" className="btn-upload cursor-pointer">
          Submit Resume
        </label>
        <input
          id="resume-upload"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const formData = new FormData();
            formData.append("file", file);
            formData.append("userId", userId);

            try {
              const res = await fetch("/api/vapi/resume", { method: "POST", body: formData });
              const data = await res.json();
              if (!data.success) throw new Error(data.error);

              const { interviewId, questions, resumeImprovements } = data;
              if (!interviewId) throw new Error("No interviewId returned from resume API");

              setCurrentInterviewId(interviewId);

              const formattedQuestions = (questions || []).map((q: string) => `- ${q}`).join("\n");

              await vapi.start(interviewer, { variableValues: { questions: formattedQuestions } });

              alert("✅ Resume analyzed! AI will now ask questions based on your resume.");
            } catch (err) {
              console.error("⚠ Resume upload failed:", err);
              alert("Error analyzing resume. Please try again.");
            }
          }}
        />
      </div>

      <div className="w-full flex justify-center gap-4 mt-6">
        <button className="btn-secondary" onClick={() => router.push("/")}>
          Back to Dashboard
        </button>
        {currentInterviewId && (
          <button className="btn-primary" onClick={() => router.push(`/interview/${currentInterviewId}/feedback`)}>
            View Feedback
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
