import { interviewCovers, mappings } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Base URL for tech icons
const techIconBaseURL = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

// Normalize tech name based on your mappings
const normalizeTechName = (tech: string) => {
  if (!tech) return "";
  const key = tech.toLowerCase().replace(/\.js$/, "").replace(/\s+/g, "");
  return mappings[key as keyof typeof mappings] || "";
};

// Check if icon exists by sending a HEAD request
const checkIconExists = async (url: string) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok; // Returns true if the icon exists
  } catch {
    return false;
  }
};

// Get tech logos safely, even if techArray is undefined
export const getTechLogos = async (techArray: string[] = []) => {
  if (!techArray || techArray.length === 0) return [];

  const logoURLs = techArray.map((tech) => {
    const normalized = normalizeTechName(tech);
    return {
      tech,
      url: normalized
        ? `${techIconBaseURL}/${normalized}/${normalized}-original.svg`
        : "/tech.svg",
    };
  });

  const results = await Promise.all(
    logoURLs.map(async ({ tech, url }) => ({
      tech,
      url: (await checkIconExists(url)) ? url : "/tech.svg",
    }))
  );

  return results;
};

// Get a random interview cover image
export const getRandomInterviewCover = () => {
  const randomIndex = Math.floor(Math.random() * interviewCovers.length);
  return `/covers${interviewCovers[randomIndex]}`;
};
