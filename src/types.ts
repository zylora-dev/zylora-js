// ── GPU types ──────────────────────────────────────────────────────────────

export const GPU_TYPES = [
  "H100",
  "H100_SXM",
  "A100_80GB",
  "A100_40GB",
  "A10G",
  "L4",
  "L40S",
  "T4",
  "RTX_4090",
  "RTX_A6000",
] as const;

export type GpuType = (typeof GPU_TYPES)[number];

// ── Enums ──────────────────────────────────────────────────────────────────

export type InvocationStatus =
  | "queued"
  | "cold_starting"
  | "running"
  | "streaming"
  | "completed"
  | "failed"
  | "timeout"
  | "cancelled";

export type Runtime =
  | "python310"
  | "python311"
  | "python312"
  | "python313";

export type Visibility = "public" | "private";

export type RoutingStrategy =
  | "cost_optimized"
  | "latency_optimized"
  | "reliability_optimized";

// ── API response types ─────────────────────────────────────────────────────

export interface ErrorDetail {
  code: string;
  message: string;
  request_id: string;
}

export interface ErrorResponse {
  error: ErrorDetail;
}

export interface AsyncJobResponse {
  job_id: string;
  status: InvocationStatus;
  created_at: string;
}

export interface AsyncJobResult {
  job_id: string;
  status: InvocationStatus;
  result: unknown;
  error: ErrorDetail | null;
  created_at: string;
  completed_at: string | null;
}

export interface BatchResultItem {
  index: number;
  status: "completed" | "failed";
  result: unknown;
  error: ErrorDetail | null;
}

export interface BatchResponse {
  results: BatchResultItem[];
  total: number;
  succeeded: number;
  failed: number;
}

// ── Client options ─────────────────────────────────────────────────────────

export interface ZyloraOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

// ── Invocation options ─────────────────────────────────────────────────────

export interface InvokeOptions {
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Additional headers to send with the request. */
  headers?: Record<string, string>;
}

export interface BatchOptions extends InvokeOptions {
  /** Max parallel invocations (1–100). Default: 10. */
  concurrency?: number;
}

export interface StreamOptions extends InvokeOptions {
  /** AbortSignal to cancel the stream. */
  signal?: AbortSignal;
}
