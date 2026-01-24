/**
 * Tests for app/api/health/route
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

// Mock the health checker
vi.mock("@/lib/monitoring/health-check", () => ({
  healthChecker: {
    checkHealth: vi.fn(),
  },
}));

// Mock Supabase client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    // Set required environment variables
    process.env.OPENAI_API_KEY = "test-key";
    process.env.STRIPE_SECRET_KEY = "test-stripe-key";
    process.env.KV_REST_API_URL = "https://test.upstash.io";
    process.env.KV_REST_API_TOKEN = "test-token";
    // NODE_ENV is already set by vitest
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 status when all services are healthy", async () => {
    const { healthChecker } = await import("@/lib/monitoring/health-check");
    vi.mocked(healthChecker.checkHealth).mockResolvedValue({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "healthy", responseTime: 5 },
        openai: { status: "healthy", responseTime: 1 },
        supabaseAuth: { status: "healthy", responseTime: 3 },
        emailService: { status: "healthy", responseTime: 2 },
        rateLimiting: { status: "healthy", responseTime: 1 },
      },
      metrics: {
        responseTime: 10,
        uptime: 1000,
        memoryUsage: {
          rss: 1000000,
          heapTotal: 500000,
          heapUsed: 250000,
          external: 0,
          arrayBuffers: 0,
        },
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("healthy");
    expect(json.timestamp).toBeDefined();
    expect(json.services).toBeDefined();
  });

  it("returns 503 status when critical services are unhealthy", async () => {
    const { healthChecker } = await import("@/lib/monitoring/health-check");
    vi.mocked(healthChecker.checkHealth).mockResolvedValue({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: "unhealthy",
          error: "Connection failed",
          responseTime: 5000,
        },
        openai: { status: "healthy", responseTime: 1 },
        supabaseAuth: { status: "healthy", responseTime: 3 },
        emailService: { status: "healthy", responseTime: 2 },
        rateLimiting: { status: "healthy", responseTime: 1 },
      },
      metrics: {
        responseTime: 5000,
        uptime: 1000,
        memoryUsage: {
          rss: 1000000,
          heapTotal: 500000,
          heapUsed: 250000,
          external: 0,
          arrayBuffers: 0,
        },
      },
    });

    const response = await GET();
    expect(response.status).toBe(503);

    const json = await response.json();
    expect(json.status).toBe("unhealthy");
  });

  it("returns 200 status when only non-critical services are degraded", async () => {
    const { healthChecker } = await import("@/lib/monitoring/health-check");
    vi.mocked(healthChecker.checkHealth).mockResolvedValue({
      status: "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "healthy", responseTime: 5 },
        openai: { status: "healthy", responseTime: 1 },
        supabaseAuth: { status: "healthy", responseTime: 3 },
        emailService: {
          status: "degraded",
          error: "Not configured",
          responseTime: 2,
        },
        rateLimiting: {
          status: "degraded",
          error: "Missing Redis",
          responseTime: 1,
        },
      },
      metrics: {
        responseTime: 10,
        uptime: 1000,
        memoryUsage: {
          rss: 1000000,
          heapTotal: 500000,
          heapUsed: 250000,
          external: 0,
          arrayBuffers: 0,
        },
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("degraded");
  });

  it("includes service status in response", async () => {
    const { healthChecker } = await import("@/lib/monitoring/health-check");
    vi.mocked(healthChecker.checkHealth).mockResolvedValue({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "healthy", responseTime: 5 },
        openai: { status: "healthy", responseTime: 1 },
        supabaseAuth: { status: "healthy", responseTime: 3 },
        emailService: { status: "healthy", responseTime: 2 },
        rateLimiting: { status: "healthy", responseTime: 1 },
      },
      metrics: {
        responseTime: 10,
        uptime: 1000,
        memoryUsage: {
          rss: 1000000,
          heapTotal: 500000,
          heapUsed: 250000,
          external: 0,
          arrayBuffers: 0,
        },
      },
    });

    const response = await GET();
    const json = await response.json();

    expect(json.services).toHaveProperty("database");
    expect(json.services).toHaveProperty("auth");
    expect(json.services).toHaveProperty("stripe");
    expect(json.services).toHaveProperty("openai");
    expect(json.services).toHaveProperty("redis");
  });

  it("includes metrics in response", async () => {
    const { healthChecker } = await import("@/lib/monitoring/health-check");
    vi.mocked(healthChecker.checkHealth).mockResolvedValue({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "healthy", responseTime: 5 },
        openai: { status: "healthy", responseTime: 1 },
        supabaseAuth: { status: "healthy", responseTime: 3 },
        emailService: { status: "healthy", responseTime: 2 },
        rateLimiting: { status: "healthy", responseTime: 1 },
      },
      metrics: {
        responseTime: 10,
        uptime: 1000,
        memoryUsage: {
          rss: 1000000,
          heapTotal: 500000,
          heapUsed: 250000,
          external: 0,
          arrayBuffers: 0,
        },
      },
    });

    const response = await GET();
    const json = await response.json();

    expect(json.uptime).toBeDefined();
    expect(json.version).toBeDefined();
    expect(json.environment).toBeDefined();
    expect(json.metrics).toBeDefined();
  });

  it("returns fallback response when health checker throws", async () => {
    const { healthChecker } = await import("@/lib/monitoring/health-check");
    vi.mocked(healthChecker.checkHealth).mockRejectedValue(
      new Error("Health check failed"),
    );

    const response = await GET();
    expect(response.status).toBe(503);

    const json = await response.json();
    expect(json.status).toBe("unhealthy");
    expect(json.error).toBe("Health check failed");
  });

  it("includes timestamp in response", async () => {
    const { healthChecker } = await import("@/lib/monitoring/health-check");
    const now = new Date().toISOString();
    vi.mocked(healthChecker.checkHealth).mockResolvedValue({
      status: "healthy",
      timestamp: now,
      services: {
        database: { status: "healthy", responseTime: 5 },
        openai: { status: "healthy", responseTime: 1 },
        supabaseAuth: { status: "healthy", responseTime: 3 },
        emailService: { status: "healthy", responseTime: 2 },
        rateLimiting: { status: "healthy", responseTime: 1 },
      },
      metrics: {
        responseTime: 10,
        uptime: 1000,
        memoryUsage: {
          rss: 1000000,
          heapTotal: 500000,
          heapUsed: 250000,
          external: 0,
          arrayBuffers: 0,
        },
      },
    });

    const response = await GET();
    const json = await response.json();

    expect(json.timestamp).toBeDefined();
    expect(new Date(json.timestamp).toISOString()).toBe(now);
  });
});
