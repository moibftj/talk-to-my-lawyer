# OpenTelemetry Tracing for Talk-To-My-Lawyer

This document explains how to set up and use OpenTelemetry distributed tracing in the Talk-To-My-Lawyer application.

## Overview

OpenTelemetry tracing has been added to provide observability into:
- AI operations (OpenAI API calls with retry logic)
- Database operations (Supabase queries and RPCs)
- HTTP requests and API routes
- Business operations (letter generation, subscription management)

## Quick Start

### 1. Install Dependencies

The required OpenTelemetry dependencies have been added to `package.json`:

```bash
pnpm install
```

### 2. Configure Environment

Add tracing configuration to your `.env.local`:

```bash
# Optional: OTLP endpoint (defaults to localhost:4318)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Optional: Authentication headers (JSON format)
OTEL_EXPORTER_OTLP_HEADERS='{"authorization":"Bearer YOUR_TOKEN"}'

# Optional: Service configuration
OTEL_SERVICE_NAME=talk-to-my-lawyer
OTEL_SERVICE_VERSION=1.0.0

# Optional: Disable tracing
OTEL_SDK_DISABLED=false
```

### 3. Run a Local Trace Collector

For local development, you can use Jaeger or OTEL Collector:

#### Option A: Jaeger (Simple)
```bash
docker run -d --name jaeger \\
  -p 14268:14268 \\
  -p 14250:14250 \\
  -p 6831:6831/udp \\
  -p 6832:6832/udp \\
  -p 16686:16686 \\
  -p 4317:4317 \\
  -p 4318:4318 \\
  jaegertracing/all-in-one:latest
```

Then visit http://localhost:16686 to view traces.

#### Option B: OTEL Collector + Jaeger
Create `otel-collector.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger]
```

```bash
docker run -d --name otel-collector \\
  -p 4317:4317 -p 4318:4318 \\
  -v ./otel-collector.yaml:/etc/otel-collector.yaml \\
  otel/opentelemetry-collector:latest \\
  --config=/etc/otel-collector.yaml
```

### 4. Start the Application

```bash
pnpm dev
```

Tracing will be automatically initialized when the app starts.

## What Gets Traced

### AI Operations
- **Location**: `lib/ai/openai-retry.ts`
- **Spans**: `ai.generateTextWithRetry`, `ai.generateTextWithRetryWrapper`, `ai.healthCheck`
- **Attributes**: model, temperature, token counts, retry attempts, response length
- **Events**: generation attempts, errors, circuit breaker states

### API Routes
- **Location**: `app/api/generate-letter/route.ts`
- **Spans**: `business.generate_letter`, `ai.generateLetterContent`
- **Attributes**: user info, letter type, request details
- **Events**: authentication, validation, generation progress

### HTTP Requests
- **Auto-instrumented**: All incoming HTTP requests
- **Filtering**: Health checks and static assets are filtered out
- **Attributes**: URL, method, user agent, response status

### Database Operations
- **Helper**: `lib/monitoring/db-tracing.ts`
- **Functions**: `traceDbQuery()`, `traceDbRpc()`, `createTracedSupabaseClient()`
- **Usage**: Wrap Supabase calls for automatic tracing

## Using Tracing in Your Code

### Manual Span Creation

```typescript
import { createAISpan, createBusinessSpan, createDatabaseSpan } from '@/lib/monitoring/tracing'

// AI operations
const span = createAISpan('custom_ai_operation', {
  'ai.model': 'gpt-4-turbo',
  'ai.temperature': 0.7
})

try {
  // Your AI operation
  span.setStatus({ code: 1 }) // SUCCESS
} catch (error) {
  span.recordException(error)
  span.setStatus({ code: 2, message: error.message })
  throw error
} finally {
  span.end()
}
```

### Async Function Tracing

```typescript
import { traceAsync } from '@/lib/monitoring/tracing'

const result = await traceAsync(
  'my_operation',
  async () => {
    // Your async operation
    return await someAsyncWork()
  },
  { 'custom.attribute': 'value' }
)
```

### Database Tracing

```typescript
import { traceDbQuery, traceDbRpc } from '@/lib/monitoring/db-tracing'

// Query tracing
const users = await traceDbQuery(
  'select',
  'profiles',
  async () => {
    return await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'subscriber')
  },
  { 'query.filter': 'role=subscriber' }
)

// RPC tracing
const allowance = await traceDbRpc(
  'check_letter_allowance',
  async () => {
    return await supabase.rpc('check_letter_allowance', { u_id: userId })
  },
  { 'user.id': userId }
)
```

### Adding Events and Attributes

```typescript
import { addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

// Add attributes to current span
addSpanAttributes({
  'user.id': userId,
  'operation.batch_size': items.length
})

// Record events with optional attributes
recordSpanEvent('processing_started', {
  batch_size: items.length
})
```

## Span Conventions

### Naming
- AI operations: `ai.operation_name`
- Database operations: `db.operation_name` 
- Business operations: `business.operation_name`
- HTTP operations: `http.method /path`

### Attributes
- **AI**: `ai.model`, `ai.temperature`, `ai.prompt_length`, `ai.response_length`, `ai.attempts`
- **Database**: `db.system`, `db.table`, `db.operation`, `db.duration_ms`
- **Business**: `business.operation`, `user.id`, `user.email`
- **HTTP**: `http.method`, `http.route`, `http.user_agent`, `http.status_code`

### Status Codes
- `1`: SUCCESS
- `2`: ERROR

## Production Considerations

### Performance
- Uses `BatchSpanProcessor` in production for better performance
- Uses `SimpleSpanProcessor` in development for immediate visibility
- HTTP instrumentation filters out health checks and static assets

### Configuration
```typescript
// In production, configure for your observability platform
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-observability-platform.com/v1/traces
OTEL_EXPORTER_OTLP_HEADERS='{"authorization":"Bearer YOUR_PRODUCTION_TOKEN"}'
```

### Sampling
Consider adding sampling for high-traffic applications:

```typescript
// In lib/monitoring/tracing.ts
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node'

const provider = new NodeTracerProvider({
  resource: resource,
  sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces
})
```

## Observability Platforms

### Jaeger (Self-hosted)
- **Pros**: Free, full control, good for development
- **Cons**: Requires maintenance, no alerting

### Commercial Options
- **Datadog**: `OTEL_EXPORTER_OTLP_ENDPOINT=https://trace-intake.datadoghq.com/v1/traces`
- **New Relic**: `OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net:4318/v1/traces`
- **Honeycomb**: `OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io/v1/traces/DATASET`

## Troubleshooting

### Tracing Not Working
1. Check console logs during app startup for tracing errors
2. Verify OTLP endpoint is reachable: `curl -v http://localhost:4318/v1/traces`
3. Check environment variables are set correctly
4. Ensure Next.js is running in Node.js runtime (not Edge)

### High Overhead
1. Reduce sampling rate in production
2. Filter out unnecessary operations
3. Use BatchSpanProcessor with appropriate batch settings
4. Consider async export to reduce latency

### Missing Spans
1. Ensure spans are properly ended with `span.end()` or in `finally` blocks
2. Check for uncaught exceptions that prevent span closure
3. Verify instrumentation is loaded before the instrumented libraries

## Development Workflow

1. Start trace collector (Jaeger)
2. Start application with `pnpm dev`
3. Generate some letters or perform operations
4. View traces in Jaeger UI at http://localhost:16686
5. Look for patterns, errors, and performance bottlenecks

## Metrics vs. Tracing

This implementation focuses on **distributed tracing** (understanding request flow). For **metrics** (counters, gauges), consider adding OpenTelemetry metrics later:

```typescript
// Future enhancement - metrics
import { metrics } from '@opentelemetry/api'
const meter = metrics.getMeter('talk-to-my-lawyer')
const letterCounter = meter.createCounter('letters_generated_total')
letterCounter.add(1, { letter_type: 'demand' })
```