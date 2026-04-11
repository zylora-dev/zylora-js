import { describe, it, expect } from "vitest";
import {
  ZyloraError,
  AuthenticationError,
  InsufficientCreditsError,
  FunctionNotFoundError,
  RateLimitError,
  ProviderError,
  TimeoutError,
  ValidationError,
  NoCapacityError,
  mapError,
} from "../src/errors.js";

describe("error classes", () => {
  it("ZyloraError stores requestId", () => {
    const err = new ZyloraError("boom", "req-123");
    expect(err.message).toBe("boom");
    expect(err.requestId).toBe("req-123");
    expect(err.name).toBe("ZyloraError");
    expect(err).toBeInstanceOf(Error);
  });

  it("AuthenticationError defaults message", () => {
    const err = new AuthenticationError();
    expect(err.message).toBe("Invalid or missing API key");
    expect(err).toBeInstanceOf(ZyloraError);
  });

  it("RateLimitError stores retryAfter", () => {
    const err = new RateLimitError("slow down", "req-1", 30);
    expect(err.retryAfter).toBe(30);
    expect(err.name).toBe("RateLimitError");
  });
});

describe("mapError", () => {
  it("maps 401 to AuthenticationError", () => {
    const err = mapError(401, { code: "auth_error", message: "bad key", request_id: "r1" });
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe("bad key");
    expect(err.requestId).toBe("r1");
  });

  it("maps 402 to InsufficientCreditsError", () => {
    const err = mapError(402, { code: "insufficient_credits", message: "no money", request_id: "r2" });
    expect(err).toBeInstanceOf(InsufficientCreditsError);
  });

  it("maps 404 to FunctionNotFoundError", () => {
    const err = mapError(404, undefined);
    expect(err).toBeInstanceOf(FunctionNotFoundError);
    expect(err.message).toBe("Function not found");
  });

  it("maps 408 to TimeoutError", () => {
    const err = mapError(408, { code: "timeout", message: "too slow", request_id: "r3" });
    expect(err).toBeInstanceOf(TimeoutError);
  });

  it("maps 422 to ValidationError", () => {
    const err = mapError(422, { code: "validation", message: "bad input", request_id: "r4" });
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("maps 429 to RateLimitError", () => {
    const err = mapError(429, { code: "rate_limit", message: "throttled", request_id: "r5" });
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it("maps 503 to NoCapacityError", () => {
    const err = mapError(503, { code: "no_capacity", message: "full", request_id: "r6" });
    expect(err).toBeInstanceOf(NoCapacityError);
  });

  it("maps unknown status to ZyloraError", () => {
    const err = mapError(500, undefined);
    expect(err).toBeInstanceOf(ZyloraError);
    expect(err.message).toBe("Request failed with status 500");
    // Should not be a more specific subclass
    expect(err).not.toBeInstanceOf(ProviderError);
  });
});
