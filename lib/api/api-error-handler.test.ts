/**
 * Tests for lib/api/api-error-handler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  handleApiError,
  withApiHandler,
  apiRouteHandler,
  successResponse,
  errorResponses,
} from "./api-error-handler";
import { ZodError } from "zod";

describe("ApiError Classes", () => {
  describe("ApiError", () => {
    it("creates error with correct properties", () => {
      const error = new ApiError(400, "Bad request", "BAD_REQUEST", {
        field: "value",
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ApiError");
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Bad request");
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.details).toEqual({ field: "value" });
    });

    it("creates error without optional properties", () => {
      const error = new ApiError(500, "Server error");

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe("Server error");
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  describe("AuthenticationError", () => {
    it("creates 401 error with default message", () => {
      const error = new AuthenticationError();

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Authentication required");
      expect(error.code).toBe("AUTHENTICATION_ERROR");
    });

    it("creates 401 error with custom message", () => {
      const error = new AuthenticationError("Invalid token");

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Invalid token");
      expect(error.code).toBe("AUTHENTICATION_ERROR");
    });
  });

  describe("AuthorizationError", () => {
    it("creates 403 error with default message", () => {
      const error = new AuthorizationError();

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe("Insufficient permissions");
      expect(error.code).toBe("AUTHORIZATION_ERROR");
    });

    it("creates 403 error with custom message", () => {
      const error = new AuthorizationError("Admin access required");

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe("Admin access required");
      expect(error.code).toBe("AUTHORIZATION_ERROR");
    });
  });

  describe("ValidationError", () => {
    it("creates 400 error with details", () => {
      const details = { email: "Invalid email format" };
      const error = new ValidationError("Validation failed", details);

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Validation failed");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual(details);
    });

    it("creates 400 error without details", () => {
      const error = new ValidationError("Invalid input");

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Invalid input");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toBeUndefined();
    });
  });

  describe("NotFoundError", () => {
    it("creates 404 error with default resource name", () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Resource not found");
      expect(error.code).toBe("NOT_FOUND");
    });

    it("creates 404 error with custom resource name", () => {
      const error = new NotFoundError("Letter");

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Letter not found");
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("RateLimitError", () => {
    it("creates 429 error with default message", () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.code).toBe("RATE_LIMIT_ERROR");
    });

    it("creates 429 error with custom message", () => {
      const error = new RateLimitError("Too many requests. Try again later.");

      expect(error.statusCode).toBe(429);
      expect(error.message).toBe("Too many requests. Try again later.");
      expect(error.code).toBe("RATE_LIMIT_ERROR");
    });
  });

  describe("ExternalServiceError", () => {
    it("creates 502 error with default message", () => {
      const error = new ExternalServiceError("OpenAI");

      expect(error.statusCode).toBe(502);
      expect(error.message).toBe("External service OpenAI unavailable");
      expect(error.code).toBe("EXTERNAL_SERVICE_ERROR");
    });

    it("creates 502 error with custom message", () => {
      const error = new ExternalServiceError(
        "Stripe",
        "Payment gateway is down",
      );

      expect(error.statusCode).toBe(502);
      expect(error.message).toBe("Payment gateway is down");
      expect(error.code).toBe("EXTERNAL_SERVICE_ERROR");
    });
  });
});

describe("handleApiError", () => {
  beforeEach(() => {
    // Mock isDevelopment to true
    vi.mock("@/lib/config/env", () => ({
      isDevelopment: () => true,
    }));
  });

  it("handles ApiError correctly", async () => {
    const error = new ApiError(400, "Bad request", "BAD_REQUEST");
    const response = handleApiError(error, "TestContext", "req-123");

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Bad request");
    expect(json.code).toBe("BAD_REQUEST");
    expect(json.requestId).toBe("req-123");
  });

  it("includes ApiError details in response", async () => {
    const details = { field: "email", message: "Invalid format" };
    const error = new ValidationError("Validation failed", details);
    const response = handleApiError(error);

    const json = await response.json();
    expect(json.details).toEqual(details);
  });

  it("handles ZodError correctly", async () => {
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["email"],
        message: "Expected string, received number",
      } as any,
    ]);

    const response = handleApiError(zodError, "TestContext");

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.details).toBeInstanceOf(Array);
    expect(json.details[0]).toHaveProperty("path");
  });

  it("handles generic Error correctly", async () => {
    const error = new Error("Something went wrong");
    const response = handleApiError(error, "TestContext", "req-456");

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Something went wrong");
    expect(json.code).toBe("INTERNAL_ERROR");
    expect(json.requestId).toBe("req-456");
  });

  it("handles unknown error correctly", async () => {
    const error = "string error";
    const response = handleApiError(error, "TestContext");

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.code).toBe("INTERNAL_ERROR");
  });

  it("logs errors to console", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Test error");

    handleApiError(error, "TestContext", "req-789");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("withApiHandler", () => {
  it("wraps handler and catches errors", async () => {
    const handler = async () => {
      throw new ApiError(400, "Bad request");
    };

    const response = await withApiHandler(handler, "TestContext");
    expect(response.status).toBe(400);
  });

  it("returns successful response", async () => {
    const handler = async () => successResponse({ ok: true });

    const response = await withApiHandler(handler);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.ok).toBe(true);
  });
});

describe("apiRouteHandler", () => {
  it("wraps route handler and catches errors", async () => {
    const handler = () => Promise.reject(new ApiError(404, "Not found"));

    const wrapped = apiRouteHandler(handler, "TestContext");
    const request = {} as Request;

    const response = await wrapped(request);
    expect(response.status).toBe(404);
  });

  it("passes request and context to handler", async () => {
    const handler = vi.fn().mockResolvedValue(successResponse({ ok: true }));

    const wrapped = apiRouteHandler(handler, "TestContext");
    const request = {} as Request;
    const context = { params: { id: "123" } };

    const response = await wrapped(request, context);

    expect(handler).toHaveBeenCalledWith(request, context);
    expect(response.status).toBe(200);
  });
});

describe("successResponse", () => {
  it("returns 200 response with data", async () => {
    const data = { message: "Success", id: 123 };
    const response = successResponse(data);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(data);
  });

  it("returns custom status code", async () => {
    const response = successResponse({ created: true }, 201);

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.created).toBe(true);
  });

  it("defaults to 200 when status not provided", async () => {
    const response = successResponse({ data: "test" });

    expect(response.status).toBe(200);
  });
});

describe("errorResponses", () => {
  describe("unauthorized", () => {
    it("returns 401 response with default message", async () => {
      const response = errorResponses.unauthorized();

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Unauthorized");
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 response with custom message", async () => {
      const response = errorResponses.unauthorized("Invalid credentials");

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Invalid credentials");
    });
  });

  describe("forbidden", () => {
    it("returns 403 response with default message", async () => {
      const response = errorResponses.forbidden();

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Forbidden");
      expect(json.code).toBe("FORBIDDEN");
    });

    it("returns 403 response with custom message", async () => {
      const response = errorResponses.forbidden("Admin access required");

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Admin access required");
    });
  });

  describe("notFound", () => {
    it("returns 404 response with default resource", async () => {
      const response = errorResponses.notFound();

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Resource not found");
      expect(json.code).toBe("NOT_FOUND");
    });

    it("returns 404 response with custom resource", async () => {
      const response = errorResponses.notFound("Letter");

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Letter not found");
    });
  });

  describe("validation", () => {
    it("returns 400 response with message", async () => {
      const details = { email: "Invalid format" };
      const response = errorResponses.validation("Validation failed", details);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Validation failed");
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.details).toEqual(details);
    });

    it("returns 400 response without details", async () => {
      const response = errorResponses.validation("Invalid input");

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.details).toBeUndefined();
    });
  });

  describe("serverError", () => {
    it("returns 500 response with default message", async () => {
      const response = errorResponses.serverError();

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Internal server error");
      expect(json.code).toBe("INTERNAL_ERROR");
    });

    it("returns 500 response with custom message", async () => {
      const response = errorResponses.serverError("Database connection failed");

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Database connection failed");
    });
  });

  describe("rateLimited", () => {
    it("returns 429 response with default message", async () => {
      const response = errorResponses.rateLimited();

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe("Rate limit exceeded");
      expect(json.code).toBe("RATE_LIMITED");
    });

    it("returns 429 response with custom message", async () => {
      const response = errorResponses.rateLimited(
        "Too many requests. Try again in 1 hour.",
      );

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe("Too many requests. Try again in 1 hour.");
    });
  });
});
