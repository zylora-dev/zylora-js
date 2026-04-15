// ── GPU types ──────────────────────────────────────────────────────────────

// Values match the engine's serde renames (lowercase DB enum strings).
export const GPU_TYPES = [
  "t4",
  "l4",
  "rtx4090",
  "a100_40gb",
  "a100_80gb",
  "l40s",
  "h100",
  "h200",
  "b200",
  "mi300x",
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

export type Visibility = "public" | "private" | "unlisted";

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
  created_at?: string;
}

export interface AsyncJobResult {
  job_id: string;
  status: InvocationStatus;
  output: unknown;
  error: ErrorDetail | null;
  duration_ms: number | null;
  cost_cents: number | null;
  created_at?: string;
  completed_at: string | null;
}

export interface BatchResultItem {
  index: number;
  status: "completed" | "failed";
  output: unknown;
  error: string | null;
  duration_ms: number | null;
  cost_cents: number | null;
}

export interface BatchResponse {
  results: BatchResultItem[];
  total_cost_cents: number;
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
