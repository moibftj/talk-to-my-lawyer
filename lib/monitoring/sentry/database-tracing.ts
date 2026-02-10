/**
 * Database Tracing Utilities
 *
 * Wraps Supabase operations to automatically create Sentry spans
 * for performance monitoring and debugging.
 */

import * as Sentry from "@sentry/nextjs"

/**
 * Trace a Supabase query operation
 */
export async function traceSupabaseQuery<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: `${operation} ${table}`,
    },
    async (span) => {
      span?.setAttribute("db.system", "supabase")
      span?.setAttribute("db.operation", operation)
      span?.setAttribute("db.table", table)

      const dbName = process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0]
      if (dbName) {
        span?.setAttribute("db.name", dbName)
      }

      const startTime = Date.now()
      try {
        const result = await fn()
        const duration = Date.now() - startTime

        span?.setAttribute("db.success", true)
        span?.setAttribute("db.duration", duration)

        return result
      } catch (error) {
        const duration = Date.now() - startTime

        span?.setAttribute("db.success", false)
        span?.setAttribute("db.duration", duration)
        span?.recordException(error as Error)

        throw error
      }
    }
  )
}

/**
 * Trace a Supabase RPC function call
 */
export async function traceSupabaseRpc<T>(
  functionName: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: "db.rpc",
      name: `rpc ${functionName}`,
    },
    async (span) => {
      span?.setAttribute("db.system", "supabase")
      span?.setAttribute("db.function", functionName)

      const startTime = Date.now()
      try {
        const result = await fn()
        const duration = Date.now() - startTime

        span?.setAttribute("db.success", true)
        span?.setAttribute("db.duration", duration)

        return result
      } catch (error) {
        const duration = Date.now() - startTime

        span?.setAttribute("db.success", false)
        span?.setAttribute("db.duration", duration)
        span?.recordException(error as Error)

        throw error
      }
    }
  )
}

/**
 * Trace a transaction (multiple database operations)
 */
export async function traceTransaction<T>(
  transactionName: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: "db.transaction",
      name: transactionName,
    },
    async (span) => {
      span?.setAttribute("db.system", "supabase")

      try {
        return await fn()
      } catch (error) {
        span?.recordException(error as Error)
        throw error
      }
    }
  )
}
