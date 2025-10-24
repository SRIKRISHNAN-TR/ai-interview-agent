import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";

async function Home() {
  const user = await getCurrentUser();

  const [userInterviews, allInterview] = await Promise.all([
    getInterviewsByUserId(user?.id!),
    getLatestInterviews({ userId: user?.id! }),
  ]);

  const hasPastInterviews = userInterviews?.length! > 0;
  const hasUpcomingInterviews = allInterview?.length! > 0;

  // 🔹 Safely normalize date (handles FirestoreTimestamp or string)
  const normalizeDate = (dateValue: any): string | undefined => {
    if (!dateValue) return undefined;
    if (typeof dateValue === "string") return dateValue;
    if (typeof dateValue.toDate === "function") {
      return dateValue.toDate().toISOString();
    }
    return undefined;
  };

  // 🔹 Safely normalize techstack (always returns string[])
  const normalizeTechstack = (tech: any): string[] => {
    if (!tech) return [];
    if (Array.isArray(tech)) return tech.filter((t) => typeof t === "string");
    if (typeof tech === "string") return [tech];
    return [];
  };

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Practice real interview questions & get instant feedback
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="robo-dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      {/* 🔹 Past Interviews Section */}
      <section className="flex flex-col gap-6 mt-8">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          {hasPastInterviews ? (
            userInterviews?.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user?.id}
                interviewId={interview.id}
                role={interview.role ?? "Unknown Role"}
                type={interview.type ?? "General"}
                techstack={normalizeTechstack(interview.techstack)}
                createdAt={normalizeDate(interview.createdAt)}
              />
            ))
          ) : (
            <p>You haven&apos;t taken any interviews yet</p>
          )}
        </div>
      </section>

      {/* 🔹 Available Interviews Section */}
      <section className="flex flex-col gap-6 mt-8">
        <h2>Take Interviews</h2>

        <div className="interviews-section">
          {hasUpcomingInterviews ? (
            allInterview?.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user?.id}
                interviewId={interview.id}
                role={interview.role ?? "Unknown Role"}
                type={interview.type ?? "General"}
                techstack={normalizeTechstack(interview.techstack)}
                createdAt={normalizeDate(interview.createdAt)}
              />
            ))
          ) : (
            <p>There are no interviews available</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;
