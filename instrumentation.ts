/**
 * Next.js Instrumentation API
 *
 * This file is automatically called when the Next.js server starts.
 * Use it to initialize global services, monitoring, and lifecycle handlers.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await initializeTracing();
    await initializeSentry();

    console.log("[Instrumentation] Initializing server instrumentation...");

    const { getShutdownManager } =
      await import("./lib/server/graceful-shutdown");
    const shutdownManager = getShutdownManager();

    console.log("[Instrumentation] Graceful shutdown handler registered");

    shutdownManager.register("database", async () => {
      console.log("[Shutdown] Closing database connections...");
    });

    shutdownManager.register("redis", async () => {
      console.log("[Shutdown] Closing Redis connections...");
    });

    console.log("[Instrumentation] Server instrumentation complete");
  }
}

async function initializeSentry() {
  try {
    // Initialize Sentry server-side monitoring
    await import("./lib/monitoring/sentry/sentry.server.config");
    console.log("[Instrumentation] Sentry monitoring initialized");
  } catch (error) {
    console.error("[Instrumentation] Failed to initialize Sentry:", error);
  }
}

async function initializeTracing() {
  try {
    const { setupTracing } = await import("./lib/monitoring/tracing");
    await setupTracing();
    console.log("[Instrumentation] OpenTelemetry tracing initialized");
  } catch (error) {
    console.error("[Instrumentation] Failed to initialize tracing:", error);
  }
}
