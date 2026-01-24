/**
 * OpenTelemetry Tracing Configuration
 *
 * This module sets up distributed tracing for the Talk-To-My-Lawyer application
 * using OpenTelemetry. It instruments HTTP requests, AI operations, and custom spans.
 */

import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { trace } from "@opentelemetry/api";

let tracingInitialized = false;

/**
 * Initialize OpenTelemetry tracing
 */
export async function setupTracing(): Promise<void> {
  if (tracingInitialized) {
    console.log("[Tracing] Already initialized, skipping...");
    return;
  }

  try {
    // Configure OTLP endpoint
    const otlpEndpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/traces";

    // Create OTLP exporter
    const exporter = new OTLPTraceExporter({
      url: otlpEndpoint,
      // Add headers if needed for authentication
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

    // Create tracer provider with resource attributes
    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: "talk-to-my-lawyer",
      [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || "1.0.0",
      "deployment.environment": process.env.NODE_ENV || "development",
    });

    const provider = new NodeTracerProvider({
      resource,
    });

    // Use BatchSpanProcessor for production, SimpleSpanProcessor for development
    const spanProcessor =
      process.env.NODE_ENV === "production"
        ? new BatchSpanProcessor(exporter)
        : new SimpleSpanProcessor(exporter);

    provider.addSpanProcessor(spanProcessor);
    provider.register();

    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          // Filter out health check requests and static assets
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || "";
            return (
              url.includes("/api/health") ||
              url.includes("/_next/") ||
              url.includes("/favicon.ico") ||
              url.includes("/.well-known/")
            );
          },
          // Add custom attributes to spans
          requestHook: (span, request) => {
            // Type guard for IncomingMessage
            if ("url" in request && "headers" in request) {
              span.setAttributes({
                "http.route": (request as { url?: string }).url || "",
                "http.user_agent":
                  (request as { headers?: Record<string, string> }).headers?.[
                    "user-agent"
                  ] || "",
              });
            }
          },
        }),
      ],
    });

    tracingInitialized = true;
    console.log(
      `[Tracing] OpenTelemetry initialized with endpoint: ${otlpEndpoint}`,
    );
  } catch (error) {
    console.error("[Tracing] Failed to initialize OpenTelemetry:", error);
    throw error;
  }
}

/**
 * Get the global tracer instance
 */
export function getTracer(name = "talk-to-my-lawyer") {
  return trace.getTracer(name);
}

/**
 * Create a custom span for AI operations
 */
export function createAISpan(
  operationName: string,
  attributes: Record<string, string | number | boolean> = {},
) {
  const tracer = getTracer();
  return tracer.startSpan(`ai.${operationName}`, {
    attributes: {
      "ai.operation": operationName,
      "ai.provider": "openai",
      ...attributes,
    },
  });
}

/**
 * Create a custom span for database operations
 */
export function createDatabaseSpan(
  operation: string,
  table?: string,
  attributes: Record<string, string | number | boolean> = {},
) {
  const tracer = getTracer();
  return tracer.startSpan(`db.${operation}`, {
    attributes: {
      "db.operation": operation,
      "db.system": "supabase",
      "db.table": table,
      ...attributes,
    },
  });
}

/**
 * Create a custom span for business operations
 */
export function createBusinessSpan(
  operationName: string,
  attributes: Record<string, string | number | boolean> = {},
) {
  const tracer = getTracer();
  return tracer.startSpan(`business.${operationName}`, {
    attributes: {
      "business.operation": operationName,
      ...attributes,
    },
  });
}

/**
 * Trace an async function with automatic span lifecycle management
 */
export async function traceAsync<T>(
  spanName: string,
  fn: () => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(spanName, { attributes });

  try {
    const result = await fn();
    span.setStatus({ code: 1 }); // SUCCESS
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: 2, // ERROR
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add custom attributes to the current span
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>,
) {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttributes(attributes);
  }
}

/**
 * Record an event in the current span
 */
export function recordSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>,
) {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}
