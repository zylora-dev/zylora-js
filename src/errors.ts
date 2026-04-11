import type { ErrorDetail } from "./types.js";

/** Base error class for all Zylora SDK errors. */
export class ZyloraError extends Error {
  readonly requestId: string | undefined;

  constructor(message: string, requestId?: string) {
    super(message);
    this.name = "ZyloraError";
    this.requestId = requestId;
  }
}

/** API key is missing or invalid (HTTP 401). */
export class AuthenticationError extends ZyloraError {
  constructor(message = "Invalid or missing API key", requestId?: string) {
    super(message, requestId);
    this.name = "AuthenticationError";
  }
}

/** Account has insufficient credits (HTTP 402). */
export class InsufficientCreditsError extends ZyloraError {
  constructor(
    message = "Insufficient credits — add credits at dash.zylora.dev/billing",
    requestId?: string,
  ) {
    super(message, requestId);
    this.name = "InsufficientCreditsError";
  }
}

/** Function not found (HTTP 404). */
export class FunctionNotFoundError extends ZyloraError {
  constructor(message = "Function not found", requestId?: string) {
    super(message, requestId);
    this.name = "FunctionNotFoundError";
  }
}

/** Rate limit exceeded (HTTP 429). */
export class RateLimitError extends ZyloraError {
  readonly retryAfter: number | undefined;

  constructor(message = "Rate limit exceeded", requestId?: string, retryAfter?: number) {
    super(message, requestId);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Upstream GPU provider error (HTTP 502/503). */
export class ProviderError extends ZyloraError {
  constructor(message = "GPU provider error", requestId?: string) {
    super(message, requestId);
    this.name = "ProviderError";
  }
}

/** Invocation timed out (HTTP 408). */
export class TimeoutError extends ZyloraError {
  constructor(message = "Invocation timed out", requestId?: string) {
    super(message, requestId);
    this.name = "TimeoutError";
  }
}

/** Container build failed (HTTP 422). */
export class BuildError extends ZyloraError {
  constructor(message = "Function build failed", requestId?: string) {
    super(message, requestId);
    this.name = "BuildError";
  }
}

/** Validation error (HTTP 422). */
export class ValidationError extends ZyloraError {
  constructor(message = "Validation error", requestId?: string) {
    super(message, requestId);
    this.name = "ValidationError";
  }
}

/** No GPU capacity available (HTTP 503). */
export class NoCapacityError extends ZyloraError {
  constructor(message = "No GPU capacity available — try again shortly", requestId?: string) {
    super(message, requestId);
    this.name = "NoCapacityError";
  }
}

/**
 * Map an HTTP status code and optional error body to a typed SDK error.
 */
export function mapError(status: number, body: ErrorDetail | undefined): ZyloraError {
  const message = body?.message;
  const requestId = body?.request_id;

  switch (status) {
    case 401:
      return new AuthenticationError(message, requestId);
    case 402:
      return new InsufficientCreditsError(message, requestId);
    case 404:
      return new FunctionNotFoundError(message, requestId);
    case 408:
      return new TimeoutError(message, requestId);
    case 422:
      return new ValidationError(message, requestId);
    case 429:
      return new RateLimitError(message, requestId);
    case 503:
      return new NoCapacityError(message, requestId);
    default:
      return new ZyloraError(
        message ?? `Request failed with status ${status}`,
        requestId,
      );
  }
}
