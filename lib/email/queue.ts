import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { EmailMessage } from './types'
import { getEmailService } from './service'

// Database row type matching the actual schema (snake_case)
interface EmailQueueRow {
  id: string
  to: string
  subject: string
  html: string | null
  text: string | null
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  max_retries: number
  next_retry_at: string | null
  error: string | null
  created_at: string
  sent_at: string | null
  updated_at: string
}

export interface EmailQueueItem {
  id?: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  maxRetries: number
  nextRetryAt?: string
  error?: string
  createdAt?: string
  sentAt?: string
}

/**
 * Email Queue Service
 * Provides reliable email delivery with retry logic and persistence
 */
export class EmailQueue {
  private supabase: SupabaseClient
  private tableName = 'email_queue' as const

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Add an email to the queue
   */
  async enqueue(message: EmailMessage, maxRetries: number = 3): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert({
          to: Array.isArray(message.to) ? message.to.join(',') : message.to,
          subject: message.subject,
          html: message.html ?? null,
          text: message.text ?? null,
          status: 'pending',
          attempts: 0,
          max_retries: maxRetries,
          next_retry_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        } as EmailQueueRow)
        .select('id')
        .single()

      if (error) {
        console.error('[EmailQueue] Failed to enqueue email:', error)
        throw error
      }

      console.log('[EmailQueue] Email queued:', { id: data?.id, to: message.to })
      return data?.id || ''
    } catch (error) {
      console.error('[EmailQueue] Error enqueueing email:', error)
      throw error
    }
  }

  /**
   * Process pending emails in the queue
   */
  async processPending(): Promise<void> {
    try {
      const { data: items, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', 'pending')
        .lte('next_retry_at', new Date().toISOString())
        .limit(10) // Process 10 at a time

      if (error) {
        console.error('[EmailQueue] Failed to fetch pending emails:', error)
        return
      }

      if (!items || items.length === 0) {
        console.log('[EmailQueue] No pending emails to process')
        return
      }

      console.log(`[EmailQueue] Processing ${items.length} pending emails`)

      for (const item of items) {
        await this.processItem(item)
      }
    } catch (error) {
      console.error('[EmailQueue] Error processing queue:', error)
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(row: EmailQueueRow): Promise<void> {
    try {
      const emailService = getEmailService()
      const message: EmailMessage = {
        to: row.to,
        subject: row.subject,
        ...(row.html && { html: row.html }),
        ...(row.text && { text: row.text })
      }

      const result = await emailService.send(message)

      if (result.success) {
        // Mark as sent
        await this.supabase
          .from(this.tableName)
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          } as Partial<EmailQueueRow>)
          .eq('id', row.id)

        console.log('[EmailQueue] Email sent successfully:', { id: row.id })
      } else {
        // Handle retry
        await this.handleRetryRow(row, result.error)
      }
    } catch (error) {
      console.error('[EmailQueue] Error processing item:', { id: row.id, error })
      await this.handleRetryRow(row, String(error))
    }
  }

  /**
   * Handle retry logic for failed emails (using EmailQueueRow from database)
   */
  private async handleRetryRow(row: EmailQueueRow, error?: string): Promise<void> {
    const newAttempts = (row.attempts || 0) + 1
    const maxRetries = row.max_retries || 3

    if (newAttempts >= maxRetries) {
      // Mark as failed
      await this.supabase
        .from(this.tableName)
        .update({
          status: 'failed',
          attempts: newAttempts,
          error: error || 'Max retries exceeded'
        } as Partial<EmailQueueRow>)
        .eq('id', row.id)

      console.error('[EmailQueue] Email failed after max retries:', {
        id: row.id,
        attempts: newAttempts,
        error
      })
    } else {
      // Schedule next retry with exponential backoff
      const backoffMs = Math.pow(2, newAttempts - 1) * 5 * 60 * 1000 // 5min, 10min, 20min
      const next_retry_at = new Date(Date.now() + backoffMs).toISOString()

      await this.supabase
        .from(this.tableName)
        .update({
          attempts: newAttempts,
          next_retry_at,
          error: error || 'Retry scheduled'
        } as Partial<EmailQueueRow>)
        .eq('id', row.id)

      console.log('[EmailQueue] Email retry scheduled:', {
        id: row.id,
        attempt: newAttempts,
        next_retry_at
      })
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number
    sent: number
    failed: number
    total: number
  }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('status')

      if (error) {
        console.error('[EmailQueue] Failed to fetch stats:', error)
        return { pending: 0, sent: 0, failed: 0, total: 0 }
      }

      const stats = {
        pending: data?.filter((item) => item.status === 'pending').length || 0,
        sent: data?.filter((item) => item.status === 'sent').length || 0,
        failed: data?.filter((item) => item.status === 'failed').length || 0,
        total: data?.length || 0
      }

      return stats
    } catch (error) {
      console.error('[EmailQueue] Error getting stats:', error)
      return { pending: 0, sent: 0, failed: 0, total: 0 }
    }
  }
}

let queueInstance: EmailQueue | null = null

export function getEmailQueue(): EmailQueue {
  if (!queueInstance) {
    queueInstance = new EmailQueue()
  }
  return queueInstance
}

/**
 * Process email queue using the optimized Edge processor
 * This function is now a thin wrapper that delegates to the Edge runtime
 */
export async function processEmailQueue(): Promise<{
  processed: number
  sent: number
  failed: number
  remaining: number
}> {
  try {
    // Delegate to the Edge processor for optimal performance
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    const processorUrl = `${baseUrl}/api/email/process-queue`
    const cronSecret = process.env.CRON_SECRET
    
    console.log('[EmailQueue] Delegating to Edge processor:', processorUrl)
    
    const response = await fetch(processorUrl, {
      method: 'POST',
      headers: {
        'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
        'Content-Type': 'application/json',
        'x-rate-limit-bypass': 'internal'
      },
      body: JSON.stringify({ 
        batchSize: 25, // Larger batch for internal processing
        force: true 
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Edge processor failed: ${response.status}`)
    }
    
    const result = await response.json()
    
    // Map Edge processor response to legacy format
    return {
      processed: result.processed || 0,
      sent: result.sent || 0,
      failed: result.failed || 0,
      remaining: 0 // Edge processor doesn't return this, would need a separate call
    }
  } catch (error) {
    console.error('[EmailQueue] Edge processor failed, using fallback:', error)
    
    // Fallback to legacy processing only as last resort
    const queue = getEmailQueue()
    const beforeStats = await queue.getStats()
    await queue.processPending()
    const afterStats = await queue.getStats()
    
    return {
      processed: beforeStats.pending - afterStats.pending,
      sent: 0, // Legacy doesn't track this separately
      failed: afterStats.failed - beforeStats.failed,
      remaining: afterStats.pending
    }
  }
}
