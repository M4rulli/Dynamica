/**
 * Shared type contracts for analysis frontend modules.
 * These models mirror backend response payloads used by the report UI.
 */

/** Supported analysis methods exposed by the backend API. */
export type AnalysisType = "nodal" | "mesh";

/** Async job lifecycle states. */
export type JobStatus = "queued" | "running" | "completed" | "failed";

/** Response payload returned when a job is created. */
export type AnalysisJobCreateResponse = {
  job_id: string;
  status: JobStatus;
};

/** Lightweight status payload polled while a job is running. */
export type AnalysisJobStatusResponse = {
  job_id: string;
  status: JobStatus;
  error?: string | null;
};

/** Full analysis output payload returned after completion. */
export type AnalysisResult = {
  job_id: string;
  analysis_type: AnalysisType;
  latex: string;
  summary: Record<string, string | number | boolean>;
  graph_info: Record<string, string | number | boolean | string[]>;
  equations: string[];
};

/** Wrapper payload for final result endpoint responses. */
export type AnalysisResultResponse = {
  status: JobStatus;
  result?: AnalysisResult | null;
  error?: string | null;
};
