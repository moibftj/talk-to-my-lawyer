/**
 * n8n Webhook Service Tests
 *
 * Tests the n8n integration for letter generation:
 * - Configuration checks (URL + auth key)
 * - Letter generation workflow with jurisdiction research
 * - Retry logic and timeouts
 * - Data transformation
 * - Event notifications
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  isN8nConfigured,
  n8nConfig,
  generateLetterViaN8n,
  transformIntakeToN8nFormat,
  sendN8nEvent,
  notifyN8nLetterCompleted,
  notifyN8nLetterFailed,
  type N8nLetterFormData,
  type N8nGenerationResult,
} from "../n8n-webhook-service";

describe("n8n Webhook Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe("n8nConfig", () => {
    it("should return webhookUrl from environment", () => {
      process.env.N8N_WEBHOOK_URL =
        "https://n8n.example.com/webhook/generate-letter";

      expect(n8nConfig.webhookUrl).toBe(
        "https://n8n.example.com/webhook/generate-letter",
      );
    });

    it("should return authKey from environment", () => {
      process.env.N8N_WEBHOOK_AUTH_KEY = "test-auth-key-123";

      expect(n8nConfig.authKey).toBe("test-auth-key-123");
    });

    it("should return isConfigured true when URL is set", () => {
      process.env.N8N_WEBHOOK_URL =
        "https://n8n.example.com/webhook/generate-letter";

      expect(n8nConfig.isConfigured).toBe(true);
    });

    it("should return isConfigured false when URL is not set", () => {
      delete process.env.N8N_WEBHOOK_URL;

      expect(n8nConfig.isConfigured).toBe(false);
    });

    it("should have correct timeout setting", () => {
      expect(n8nConfig.timeout).toBe(90000);
    });

    it("should have correct maxRetries setting", () => {
      expect(n8nConfig.maxRetries).toBe(2);
    });
  });

  describe("isN8nConfigured", () => {
    it("should return true when N8N_WEBHOOK_URL is set", () => {
      process.env.N8N_WEBHOOK_URL = "https://n8n.example.com/webhook";

      expect(isN8nConfigured()).toBe(true);
    });

    it("should return false when N8N_WEBHOOK_URL is not set", () => {
      delete process.env.N8N_WEBHOOK_URL;

      expect(isN8nConfigured()).toBe(false);
    });

    it("should return false for empty string", () => {
      process.env.N8N_WEBHOOK_URL = "";

      expect(isN8nConfigured()).toBe(false);
    });
  });

  describe("generateLetterViaN8n", () => {
    const validFormData: N8nLetterFormData = {
      letterType: "demand_letter",
      letterId: "letter-123",
      userId: "user-456",
      intakeData: {
        senderName: "John Doe",
        senderAddress: "123 Main St, Los Angeles, CA 90001",
        senderState: "CA",
        senderEmail: "john@example.com",
        recipientName: "Jane Smith",
        recipientAddress: "456 Oak Ave, New York, NY 10001",
        recipientState: "NY",
        issueDescription: "Breach of contract regarding service agreement",
        desiredOutcome: "Full refund of $5000",
      },
    };

    beforeEach(() => {
      process.env.N8N_WEBHOOK_URL =
        "https://n8n.example.com/webhook/generate-letter";
      process.env.N8N_WEBHOOK_AUTH_KEY = "test-auth-key";
    });

    it("should throw error when n8n is not configured", async () => {
      delete process.env.N8N_WEBHOOK_URL;

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        "n8n webhook is not configured",
      );
    });

    it("should successfully generate letter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            letterId: "letter-123",
            status: "pending_review",
          }),
      });

      const result = await generateLetterViaN8n(validFormData);

      expect(result.success).toBe(true);
      expect(result.supabaseUpdated).toBe(true);
      expect(result.status).toBe("pending_review");
      expect(result.letterId).toBe("letter-123");
    });

    it("should include custom auth header when auth key is set", async () => {
      process.env.N8N_WEBHOOK_AUTH_HEADER = "N8N_LETTER_WEBHOOK_AUTH_KEY";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
          }),
      });

      await generateLetterViaN8n(validFormData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://n8n.example.com/webhook/generate-letter",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Webhook-Source": "talk-to-my-lawyer",
            "X-Letter-Id": "letter-123",
            N8N_LETTER_WEBHOOK_AUTH_KEY: "test-auth-key",
          }),
        }),
      );
    });

    it("should not include Authorization header when auth key is not set", async () => {
      delete process.env.N8N_WEBHOOK_AUTH_KEY;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
          }),
      });

      await generateLetterViaN8n(validFormData);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["N8N_WEBHOOK_AUTH_KEY"]).toBeUndefined();
    });

    it("should include all form data with intakeData wrapper in request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
          }),
      });

      await generateLetterViaN8n(validFormData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(callBody.letterType).toBe("demand_letter");
      expect(callBody.letterId).toBe("letter-123");
      expect(callBody.userId).toBe("user-456");
      expect(callBody.intakeData).toBeDefined();
      expect(callBody.intakeData.senderName).toBe("John Doe");
      expect(callBody.intakeData.senderState).toBe("CA");
      expect(callBody.intakeData.recipientName).toBe("Jane Smith");
      expect(callBody.intakeData.recipientState).toBe("NY");
      expect(callBody.intakeData.issueDescription).toBe(
        "Breach of contract regarding service agreement",
      );
      expect(callBody.source).toBe("talk-to-my-lawyer");
      expect(callBody.timestamp).toBeDefined();
    });

    it("should throw error for 401 auth failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        "n8n webhook authentication failed",
      );
    });

    it("should throw error for 403 auth failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        "n8n webhook authentication failed",
      );
    });

    it("should throw error for 404 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        "n8n workflow not found",
      );
    });

    it("should retry on 500 server errors", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Server error"),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              letterId: "letter-123",
              status: "pending_review",
            }),
        });

      const resultPromise = generateLetterViaN8n(validFormData);

      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.letterId).toBe("letter-123");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries on server errors", async () => {
      vi.useRealTimers();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Persistent server error"),
      });

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        "n8n request failed (500)",
      );
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useFakeTimers();
    });

    it("should handle AbortError from timeout", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";

      mockFetch.mockRejectedValue(abortError);

      vi.useRealTimers();

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        "n8n request timed out",
      );

      vi.useFakeTimers();
    });

    it("should return result on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            letterId: "letter-123",
            status: "pending_review",
          }),
      });

      const result = await generateLetterViaN8n(validFormData);

      expect(result.letterId).toBe("letter-123");
      expect(result.status).toBe("pending_review");
      expect(result.supabaseUpdated).toBe(true);
    });
  });

  describe("transformIntakeToN8nFormat", () => {
    it("should wrap intake data in n8n format", () => {
      const intakeData = {
        senderName: "John Doe",
        senderAddress: "123 Main St",
        senderState: "CA",
        senderEmail: "john@example.com",
        senderPhone: "555-1234",
        recipientName: "Jane Smith",
        recipientAddress: "456 Oak Ave",
        recipientState: "NY",
        recipientEmail: "jane@example.com",
        issueDescription: "Contract breach",
        desiredOutcome: "Full refund",
        additionalDetails: "See attached documents",
        amountDemanded: 5000,
        deadlineDate: "2024-03-01",
        incidentDate: "2024-01-15",
        courtType: "small-claims",
      };

      const result = transformIntakeToN8nFormat(
        "letter-123",
        "user-456",
        "demand_letter",
        intakeData,
      );

      expect(result.letterId).toBe("letter-123");
      expect(result.userId).toBe("user-456");
      expect(result.letterType).toBe("Demand Letter"); // Maps to display name
      expect(result.intakeData).toEqual(intakeData);
    });

    it("should map letter type to display name", () => {
      const intakeData = {
        senderName: "John Doe",
        senderAddress: "123 Main St",
        senderState: "CA",
        recipientName: "Jane Smith",
        recipientAddress: "456 Oak Ave",
        recipientState: "NY",
        issueDescription: "Issue",
        desiredOutcome: "Resolution",
      };

      const result = transformIntakeToN8nFormat(
        "letter-123",
        "user-456",
        "cease_desist",
        intakeData,
      );

      expect(result.letterType).toBe("Cease & Desist");
    });

    it("should handle letter types not in map", () => {
      const intakeData = {
        senderName: "John Doe",
        senderAddress: "123 Main St",
        senderState: "CA",
        recipientName: "Jane Smith",
        recipientAddress: "456 Oak Ave",
        recipientState: "NY",
        issueDescription: "Issue",
        desiredOutcome: "Resolution",
      };

      const result = transformIntakeToN8nFormat(
        "letter-123",
        "user-456",
        "custom_letter_type",
        intakeData,
      );

      expect(result.letterType).toBe("custom_letter_type"); // No mapping, uses as-is
    });
  });

  describe("sendN8nEvent", () => {
    beforeEach(() => {
      process.env.N8N_EVENTS_WEBHOOK_URL =
        "https://n8n.example.com/webhook/events";
    });

    it("should return false when events webhook is not configured", async () => {
      delete process.env.N8N_EVENTS_WEBHOOK_URL;

      const result = await sendN8nEvent({
        event: "letter.generation.completed",
        timestamp: new Date().toISOString(),
        letterId: "letter-123",
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should send event to webhook with auth header", async () => {
      process.env.N8N_WEBHOOK_AUTH_KEY = "test-auth-key";
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await sendN8nEvent({
        event: "letter.generation.completed",
        timestamp: "2024-01-15T10:00:00Z",
        letterId: "letter-123",
        letterType: "demand_letter",
        userId: "user-456",
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://n8n.example.com/webhook/events",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Webhook-Event": "letter.generation.completed",
            "N8N_WEBHOOK_AUTH_KEY": "test-auth-key",
          }),
        }),
      );
    });

    it("should return false on failed response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await sendN8nEvent({
        event: "letter.generation.failed",
        timestamp: new Date().toISOString(),
        letterId: "letter-123",
        error: "Generation failed",
      });

      expect(result).toBe(false);
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await sendN8nEvent({
        event: "letter.submitted",
        timestamp: new Date().toISOString(),
        letterId: "letter-123",
      });

      expect(result).toBe(false);
    });
  });

  describe("notifyN8nLetterCompleted", () => {
    beforeEach(() => {
      process.env.N8N_EVENTS_WEBHOOK_URL =
        "https://n8n.example.com/webhook/events";
    });

    it("should send completion event with correct data", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      notifyN8nLetterCompleted(
        "letter-123",
        "demand_letter",
        "My Demand Letter",
        "user-456",
        false,
      );

      await vi.advanceTimersByTimeAsync(100);

      expect(mockFetch).toHaveBeenCalled();
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(callBody.event).toBe("letter.generation.completed");
      expect(callBody.letterId).toBe("letter-123");
      expect(callBody.letterType).toBe("demand_letter");
      expect(callBody.letterTitle).toBe("My Demand Letter");
      expect(callBody.userId).toBe("user-456");
      expect(callBody.isFreeTrial).toBe(false);
      expect(callBody.status).toBe("pending_review");
    });

    it("should not throw on error (fire-and-forget)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      expect(() => {
        notifyN8nLetterCompleted(
          "letter-123",
          "demand_letter",
          "Title",
          "user-456",
          true,
        );
      }).not.toThrow();

      await vi.advanceTimersByTimeAsync(100);
    });
  });

  describe("notifyN8nLetterFailed", () => {
    beforeEach(() => {
      process.env.N8N_EVENTS_WEBHOOK_URL =
        "https://n8n.example.com/webhook/events";
    });

    it("should send failure event with error details", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      notifyN8nLetterFailed(
        "letter-123",
        "demand_letter",
        "user-456",
        "AI service unavailable",
      );

      await vi.advanceTimersByTimeAsync(100);

      expect(mockFetch).toHaveBeenCalled();
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(callBody.event).toBe("letter.generation.failed");
      expect(callBody.letterId).toBe("letter-123");
      expect(callBody.status).toBe("failed");
      expect(callBody.error).toBe("AI service unavailable");
    });

    it("should not throw on error (fire-and-forget)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      expect(() => {
        notifyN8nLetterFailed(
          "letter-123",
          "demand_letter",
          "user-456",
          "Error",
        );
      }).not.toThrow();

      await vi.advanceTimersByTimeAsync(100);
    });
  });
});
