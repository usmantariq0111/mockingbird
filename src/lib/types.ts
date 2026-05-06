export type InterviewType =
  | "behavioral"
  | "technical"
  | "system_design"
  | "coding";

export type Difficulty = "junior" | "mid" | "senior" | "staff";

export interface InterviewConfig {
  role: string;
  company?: string;
  type: InterviewType;
  difficulty: Difficulty;
  questionCount: number;
  resumeText?: string;
  jobDescription?: string;
}

export interface Feedback {
  score: number;
  strengths: string[];
  improvements: string[];
  starCoverage?: {
    situation: boolean;
    task: boolean;
    action: boolean;
    result: boolean;
  };
  fillerWordCount?: number;
  summary: string;
}

export interface Turn {
  index: number;
  question: string;
  answer?: string;
  feedback?: Feedback;
}

export interface Session {
  id: string;
  createdAt: number;
  config: InterviewConfig;
  turns: Turn[];
  finished: boolean;
  finalReport?: FinalReport;
}

export interface FinalReport {
  overallScore: number;
  topStrengths: string[];
  topImprovements: string[];
  summary: string;
}
