/**
 * Analysis API client.
 * Provides minimal wrappers over async job endpoints used by analysisMain.
 */

import type {
  AnalysisJobCreateResponse,
  AnalysisJobStatusResponse,
  AnalysisResultResponse,
} from "./analysisTypes";
import { getLocale } from "../i18n";

// Allow runtime override from embedding pages/tests; fallback to local backend.
const API_BASE = (window as Window & { __analysisApiBase?: string }).__analysisApiBase ?? "http://127.0.0.1:8000/api/v1";

/** Fetch current status for a queued/running/completed job.  */
export async function getJobStatus(jobId: string): Promise<AnalysisJobStatusResponse> {
  const locale = getLocale();
  const res = await fetch(`${API_BASE}/analysis/jobs/${jobId}?locale=${locale}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Status request failed: ${res.status}`);
  return res.json();
}

/** Fetch final analysis result payload for a completed job. */
export async function getJobResult(jobId: string): Promise<AnalysisResultResponse> {
  const locale = getLocale();
  const res = await fetch(`${API_BASE}/analysis/jobs/${jobId}/result?locale=${locale}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Result request failed: ${res.status}`);
  return res.json();
}

/** Create a new async analysis job from the current circuit snapshot. */
export async function createJob(payload: unknown): Promise<AnalysisJobCreateResponse> {
  const res = await fetch(`${API_BASE}/analysis/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create job failed: ${res.status}`);
  return res.json();
}
