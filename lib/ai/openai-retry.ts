/**
 * OpenAI Retry Logic with Exponential Backoff
 * Provides robust retry mechanism for OpenAI API calls with OpenTelemetry tracing
 *
 * Supports Vercel AI Gateway integration for improved observability and control
 */

import { openai, createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { createHash, randomBytes } from "crypto"
import { createAISpan, addSpanAttributes, recordSpanEvent } from '../monitoring/tracing'

/**
 * Create an OpenAI client with optional Vercel AI Gateway support
 * If AI_GATEWAY_API_KEY is set, routes requests through Vercel AI Gateway
 */
function getOpenAIClient() {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY

  if (gatewayApiKey) {
    // Use Vercel AI Gateway for enhanced observability and control
    // The gateway provides: logging, rate limiting, cost tracking, caching, and fallback models
    return createOpenAI({
      baseURL: 'https://gateway.vercel.ai/api/providers/openai',
      apiKey: gatewayApiKey,
    })
  }

  // Direct OpenAI connection (fallback)
  return openai()
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitter: boolean
  retryableErrors: string[]
  retryableStatusCodes: number[]
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDurationMs: number
  retryHistory: Array<{
    attempt: number
    delay: number
    error?: string
    duration: number
  }>
}

export interface CircuitBreakerState {
  isOpen: boolean
  failureCount: number
  lastFailureTime: number
  nextAttemptTime: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: [
    'rate_limit_exceeded',
    'insufficient_quota',
    'model_overloaded',
    'openai_error',
    'timeout',
    'connection_error',
    'temporary_failure'
  ],
  retryableStatusCodes: [429, 502, 503, 504]
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  monitoringWindowMs: 300000 // 5 minutes
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  }

  private recentCalls: Array<{ timestamp: number; success: boolean }> = []

  constructor(private config = CIRCUIT_BREAKER_CONFIG) {}

  canExecute(): boolean {
    const now = Date.now()

    // Clean old calls outside monitoring window
    this.recentCalls = this.recentCalls.filter(
      call => now - call.timestamp < this.config.monitoringWindowMs
    )

    // Check if circuit should reset
    if (this.state.isOpen && now >= this.state.nextAttemptTime) {
      this.reset()
    }

    // Calculate failure rate in monitoring window
    const totalCalls = this.recentCalls.length
    const failureRate = totalCalls > 0
      ? this.recentCalls.filter(call => !call.success).length / totalCalls
      : 0

    // Open circuit if failure rate exceeds threshold
    if (!this.state.isOpen && failureRate > 0.5 && totalCalls >= 10) {
      this.open()
    }

    return !this.state.isOpen
  }

  onSuccess(): void {
    this.recentCalls.push({ timestamp: Date.now(), success: true })

    if (this.state.failureCount > 0) {
      this.state.failureCount = Math.max(0, this.state.failureCount - 1)
    }
  }

  onFailure(): void {
    const now = Date.now()
    this.recentCalls.push({ timestamp: now, success: false })

    this.state.failureCount++
    this.state.lastFailureTime = now

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.open()
    }
  }

  private open(): void {
    this.state.isOpen = true
    this.state.nextAttemptTime = Date.now() + this.config.resetTimeoutMs
  }

  private reset(): void {
    this.state = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    }
  }

  getState() {
    return { ...this.state }
  }
}

export class OpenAIRetryClient {
  private circuitBreaker: CircuitBreaker
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
    this.circuitBreaker = new CircuitBreaker()
  }

  /**
   * Generate text with retry logic and circuit breaker
   */
  async generateTextWithRetry(params: {
    prompt: string
    system?: string
    temperature?: number
    maxOutputTokens?: number
    model?: string
  }): Promise<RetryResult<string>> {
    const span = createAISpan('generateTextWithRetry', {
      'ai.model': params.model || 'gpt-4-turbo',
      'ai.temperature': params.temperature || 0.7,
      'ai.max_output_tokens': params.maxOutputTokens || 2048,
      'ai.prompt_length': params.prompt.length,
      'ai.system_prompt_length': params.system?.length || 0,
    })

    const startTime = Date.now()
    const retryHistory: RetryResult<string>['retryHistory'] = []

    try {
      // Check circuit breaker
      if (!this.circuitBreaker.canExecute()) {
        recordSpanEvent('circuit_breaker_open')
        span.setStatus({ 
          code: 2, // ERROR
          message: 'Circuit breaker is open'
        })
        
        return {
          success: false,
          error: new Error('Circuit breaker is open - OpenAI service temporarily unavailable'),
          attempts: 0,
          totalDurationMs: 0,
          retryHistory
        }
      }

      let lastError: Error | null = null

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        const attemptStartTime = Date.now()
        let delay = 0

        try {
          console.log(`[OpenAI] Attempt ${attempt + 1}/${this.config.maxRetries + 1}`)
          
          recordSpanEvent('ai_generation_attempt', {
            attempt: attempt + 1,
            max_retries: this.config.maxRetries + 1,
          })

          const { text } = await generateText({
            model: getOpenAIClient()(params.model || "gpt-4-turbo"),
            system: params.system || "You are a professional legal assistant.",
            prompt: params.prompt,
            temperature: params.temperature || 0.7,
            maxOutputTokens: params.maxOutputTokens || 2048,
          })

          if (!text) {
            throw new Error("Empty response from OpenAI")
          }

          // Success - update circuit breaker and return
          this.circuitBreaker.onSuccess()

          const duration = Date.now() - attemptStartTime
          retryHistory.push({
            attempt: attempt + 1,
            delay,
            duration
          })

          addSpanAttributes({
            'ai.response_length': text.length,
            'ai.attempts': attempt + 1,
            'ai.total_duration_ms': Date.now() - startTime,
            'ai.success': true,
          })

          recordSpanEvent('ai_generation_success', {
            attempt: attempt + 1,
            response_length: text.length,
            duration_ms: duration,
          })

          span.setStatus({ code: 1 }) // SUCCESS

          return {
            success: true,
            data: text,
            attempts: attempt + 1,
            totalDurationMs: Date.now() - startTime,
            retryHistory
          }

        } catch (error: any) {
          lastError = error
          const duration = Date.now() - attemptStartTime

          retryHistory.push({
            attempt: attempt + 1,
            delay,
            error: error.message,
            duration
          })

          console.error(`[OpenAI] Attempt ${attempt + 1} failed:`, {
            error: error.message,
            status: error.status,
            code: error.code,
            duration
          })

          recordSpanEvent('ai_generation_error', {
            attempt: attempt + 1,
            error_message: error.message,
            error_code: error.code || error.status || 'unknown',
            duration_ms: duration,
          })

          // Check if error is retryable
          if (!this.isRetryableError(error) || attempt === this.config.maxRetries) {
            this.circuitBreaker.onFailure()
            break
          }

          // Calculate delay for next attempt
          if (attempt < this.config.maxRetries) {
            delay = this.calculateBackoffDelay(attempt)
            console.log(`[OpenAI] Waiting ${delay}ms before retry...`)
            
            recordSpanEvent('ai_retry_backoff', {
              delay_ms: delay,
              next_attempt: attempt + 2,
            })
            
            await this.sleep(delay)
          }
        }
      }

      // All retries failed
      this.circuitBreaker.onFailure()

      addSpanAttributes({
        'ai.success': false,
        'ai.attempts': this.config.maxRetries + 1,
        'ai.total_duration_ms': Date.now() - startTime,
        'ai.final_error': lastError?.message || 'Unknown error',
      })

      span.recordException(lastError || new Error('Unknown error'))
      span.setStatus({ 
        code: 2, // ERROR
        message: lastError?.message || 'All retries failed'
      })

      return {
        success: false,
        error: lastError || new Error('Unknown error'),
        attempts: this.config.maxRetries + 1,
        totalDurationMs: Date.now() - startTime,
        retryHistory
      }
      
    } finally {
      span.end()
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check for retryable error codes/messages
    if (error.code && this.config.retryableErrors.includes(error.code)) {
      return true
    }

    // Check for retryable HTTP status codes
    if (error.status && this.config.retryableStatusCodes.includes(error.status)) {
      return true
    }

    // Check error message patterns
    const message = error.message?.toLowerCase() || ''
    const retryablePatterns = [
      'rate limit',
      'timeout',
      'connection',
      'temporary',
      'overloaded',
      'service unavailable'
    ]

    return retryablePatterns.some(pattern => message.includes(pattern))
  }

  /**
   * Calculate exponential backoff delay with optional jitter
   * @param attemptNumber - The current retry attempt number
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(attemptNumber: number): number {
    let delayMs = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber)

    // Cap the delay to maximum
    delayMs = Math.min(delayMs, this.config.maxDelayMs)

    // Add jitter to prevent thundering herd problem
    if (this.config.jitter) {
      const jitterRangeMs = delayMs * 0.1 // 10% jitter
      const jitterOffsetMs = Math.random() * jitterRangeMs - jitterRangeMs / 2
      delayMs += jitterOffsetMs
    }

    return Math.floor(delayMs)
  }

  /**
   * Sleep for specified milliseconds
   * @param milliseconds - Time to sleep
   */
  private sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }

  /**
   * Get current circuit breaker state
   */
  getCircuitBreakerState() {
    return this.circuitBreaker.getState()
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker() {
    this.circuitBreaker = new CircuitBreaker()
  }
}

// Singleton instance
export const openAIRetryClient = new OpenAIRetryClient()

/**
 * Convenience function for generating text with retry
 */
export async function generateTextWithRetry(params: {
  prompt: string
  system?: string
  temperature?: number
  maxOutputTokens?: number
  model?: string
}): Promise<{ text: string; attempts: number; duration: number }> {
  const span = createAISpan('generateTextWithRetryWrapper', {
    'ai.model': params.model || 'gpt-4-turbo',
    'ai.prompt_length': params.prompt.length,
  })

  try {
    const result = await openAIRetryClient.generateTextWithRetry(params)

    if (!result.success || !result.data) {
      span.recordException(result.error || new Error('Failed to generate text'))
      span.setStatus({ 
        code: 2, // ERROR
        message: result.error?.message || 'Failed to generate text after retries'
      })
      throw result.error || new Error('Failed to generate text after retries')
    }

    addSpanAttributes({
      'ai.success': true,
      'ai.attempts': result.attempts,
      'ai.duration_ms': result.totalDurationMs,
      'ai.response_length': result.data.length,
    })

    span.setStatus({ code: 1 }) // SUCCESS

    return {
      text: result.data,
      attempts: result.attempts,
      duration: result.totalDurationMs
    }
  } finally {
    span.end()
  }
}

/**
 * Generate cache key for OpenAI requests
 */
export function generateCacheKey(params: {
  prompt: string
  system?: string
  temperature?: number
  maxOutputTokens?: number
  model?: string
}): string {
  const keyData = {
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    model: params.model
  }

  const keyString = JSON.stringify(keyData)
  return createHash('sha256').update(keyString).digest('hex')
}

/**
 * Check if OpenAI API is healthy
 */
export async function checkOpenAIHealth(): Promise<{
  healthy: boolean
  responseTime?: number
  error?: string
}> {
  const span = createAISpan('healthCheck', {
    'ai.operation': 'health_check',
    'ai.model': 'gpt-4-turbo',
  })

  try {
    const startTime = Date.now()

    // Simple health check - generate a short completion
    const result = await openAIRetryClient.generateTextWithRetry({
      prompt: "Respond with exactly: OK",
      system: "You are a health check service.",
      temperature: 0,
      maxOutputTokens: 16,
      model: "gpt-4-turbo"
    })

    const responseTime = Date.now() - startTime
    const isHealthy = result.success && result.data === 'OK'

    addSpanAttributes({
      'ai.health.response_time_ms': responseTime,
      'ai.health.is_healthy': isHealthy,
      'ai.health.attempts': result.attempts,
    })

    if (isHealthy) {
      recordSpanEvent('health_check_success', {
        response_time_ms: responseTime,
        attempts: result.attempts,
      })
      span.setStatus({ code: 1 }) // SUCCESS
    } else {
      recordSpanEvent('health_check_failure', {
        error: result.error?.message || 'Response was not "OK"',
      })
      span.setStatus({ 
        code: 2, // ERROR
        message: result.error?.message || 'Response was not "OK"'
      })
    }

    return {
      healthy: isHealthy,
      responseTime,
      error: result.success ? undefined : result.error?.message
    }
  } catch (error: any) {
    span.recordException(error)
    span.setStatus({ 
      code: 2, // ERROR
      message: error.message
    })

    recordSpanEvent('health_check_exception', {
      error: error.message,
    })

    return {
      healthy: false,
      error: error.message
    }
  } finally {
    span.end()
  }
}