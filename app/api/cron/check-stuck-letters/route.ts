// Stuck Letter Detection Cron Job
// POST /api/cron/check-stuck-letters
//
// Runs periodically to detect letters stuck in 'generating' status
// and sends alerts to admins for manual intervention.
//
// RUN SCHEDULE: Every 15 minutes (recommended)
// Cron expression: */15 * * * *
//
// ENVIRONMENT VARIABLES:
// - CRON_SECRET: Required for authentication
// - ADMIN_EMAIL: Optional, for alert delivery
//
// BEHAVIOR:
// - Finds letters in 'generating' status for > 10 minutes
// - Sends alert email to admins with stuck letter details
// - Marks letters as 'failed' if stuck > 1 hour (configurable)
// - Logs all actions for audit trail
import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/middleware/cron-auth"
import { db } from "@/lib/db/client-factory"
import { successResponse, errorResponses } from "@/lib/api/api-error-handler"
import { queueTemplateEmail } from "@/lib/email/service"
import { getAppUrl } from "@/lib/config"

export const runtime = "nodejs"

// Configuration thresholds (in minutes)
const STUCK_THRESHOLD_MINUTES = 10
const FAIL_THRESHOLD_MINUTES = 60

interface StuckLetter {
  id: string
  user_id: string
  letter_type: string
  title: string
  status: string
  created_at: string
  updated_at: string
  profiles: {
    email: string
    full_name: string
  }
}

interface StuckLettersReport {
  total: number
  stuck: StuckLetter[]
  needsFailure: StuckLetter[]
}

/**
 * GET /api/cron/check-stuck-letters
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  return successResponse({
    endpoint: "/api/cron/check-stuck-letters",
    method: "POST",
    schedule: "*/15 * * * * (every 15 minutes)",
    description: "Detects letters stuck in 'generating' status and sends alerts",
    thresholds: {
      stuck: `${STUCK_THRESHOLD_MINUTES} minutes`,
      autoFail: `${FAIL_THRESHOLD_MINUTES} minutes`
    },
    actions: [
      `Alert admins for letters stuck > ${STUCK_THRESHOLD_MINUTES} minutes`,
      `Mark as failed for letters stuck > ${FAIL_THRESHOLD_MINUTES} minutes`
    ]
  })
}

/**
 * POST /api/cron/check-stuck-letters
 * Main cron job handler
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Verify cron authentication
  const authError = verifyCronAuth(request)
  if (authError) return authError

  try {
    const serviceClient = db.serviceRole()

    // Find letters stuck in 'generating' status
    const stuckTime = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString()
    const failTime = new Date(Date.now() - FAIL_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    // Query for stuck letters with user profile info
    const { data: stuckLetters, error: queryError } = await (serviceClient as any)
      .from("letters")
      .select(`
        id,
        user_id,
        letter_type,
        title,
        status,
        created_at,
        updated_at,
        profiles (
          email,
          full_name
        )
      `)
      .eq("status", "generating")
      .lt("created_at", stuckTime)
      .order("created_at", { ascending: false })
      .limit(50)

    if (queryError) {
      console.error("[StuckLetters] Query error:", queryError)
      throw queryError
    }

    const report: StuckLettersReport = {
      total: stuckLetters?.length || 0,
      stuck: [],
      needsFailure: []
    }

    if (!stuckLetters || stuckLetters.length === 0) {
      console.log("[StuckLetters] No stuck letters found")
      return successResponse({
        message: "No stuck letters detected",
        report,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }

    // Categorize letters by how long they've been stuck
    for (const letter of stuckLetters) {
      const createdAt = new Date(letter.created_at)
      const minutesStuck = Math.floor((Date.now() - createdAt.getTime()) / (60 * 1000))

      if (minutesStuck >= FAIL_THRESHOLD_MINUTES) {
        report.needsFailure.push(letter)
      } else {
        report.stuck.push(letter)
      }
    }

    console.log(`[StuckLetters] Found ${report.total} stuck letters (${report.needsFailure.length} need failure)`)

    // Process letters that need to be marked as failed
    for (const letter of report.needsFailure) {
      await markLetterAsFailed(serviceClient, letter.id, "Letter generation timeout - exceeded maximum wait time")
    }

    // Send admin alert if there are stuck letters
    if (report.stuck.length > 0 || report.needsFailure.length > 0) {
      await sendAdminAlert(report)
    }

    return successResponse({
      message: `Processed ${report.total} stuck letters`,
      report: {
        total: report.total,
        alerted: report.stuck.length,
        failed: report.needsFailure.length
      },
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("[StuckLetters] Cron job failed:", error)
    return errorResponses.serverError("Failed to check for stuck letters")
  }
}

/**
 * Mark a letter as failed and refund allowance if applicable
 */
async function markLetterAsFailed(
  serviceClient: any,
  letterId: string,
  reason: string
): Promise<void> {
  try {
    // Update letter status
    const { error: updateError } = await serviceClient
      .from("letters")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
        generation_error: reason
      })
      .eq("id", letterId)

    if (updateError) {
      console.error(`[StuckLetters] Failed to update letter ${letterId}:`, updateError)
      return
    }

    // Log audit trail
    await serviceClient.rpc("log_letter_audit", {
      p_letter_id: letterId,
      p_action: "generation_failed",
      p_admin_id: "system",
      p_old_status: "generating",
      p_new_status: "failed",
      p_details: JSON.stringify({
        source: "stuck_letter_cron",
        reason: reason,
        auto_failed: true
      })
    })

    // LIMITATION: Cannot refund allowance in cron context
    // The refund_letter_allowance RPC now uses auth.uid() internally for security,
    // but service role clients don't have an auth.uid() context (returns NULL).
    // This means automated refunds for stuck letters won't work with the current implementation.
    // 
    // Options to fix:
    // 1. Create a separate admin_refund_letter_allowance(user_id, amount) RPC function
    //    that requires service role and explicitly accepts user_id parameter
    // 2. Accept that stuck letters don't get automatic refunds (requires manual intervention)
    // 3. Use a different refund mechanism that doesn't rely on RLS/auth.uid()
    //
    // For now, we skip the refund. The letter is marked as failed, which prevents
    // user confusion, and admins can manually refund if needed.
    console.log(`[StuckLetters] Note: Automatic refund skipped - requires manual intervention for user`)

    console.log(`[StuckLetters] Marked letter ${letterId} as failed: ${reason}`)

  } catch (error) {
    console.error(`[StuckLetters] Error marking letter ${letterId} as failed:`, error)
  }
}

/**
 * Send alert email to admins about stuck letters
 */
async function sendAdminAlert(report: StuckLettersReport): Promise<void> {
  const siteUrl = getAppUrl()
  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    console.warn("[StuckLetters] No ADMIN_EMAIL configured, skipping alert")
    return
  }

  // Build alert message
  let alertMessage = `Stuck Letter Detection Alert\n\n`
  alertMessage += `Total stuck letters: ${report.total}\n`

  if (report.stuck.length > 0) {
    alertMessage += `\nLetters requiring attention (${report.stuck.length}):\n`
    for (const letter of report.stuck.slice(0, 10)) {
      const minutesStuck = Math.floor((Date.now() - new Date(letter.created_at).getTime()) / (60 * 1000))
      alertMessage += `- ${letter.title} (${letter.letter_type}) - stuck for ${minutesStuck} minutes\n`
      alertMessage += `  User: ${letter.profiles?.full_name || 'Unknown'} (${letter.profiles?.email || 'No email'})\n`
      alertMessage += `  Review: ${siteUrl}/secure-admin-gateway/review/${letter.id}\n`
    }

    if (report.stuck.length > 10) {
      alertMessage += `... and ${report.stuck.length - 10} more\n`
    }
  }

  if (report.needsFailure.length > 0) {
    alertMessage += `\nLetters auto-failed (${report.needsFailure.length}):\n`
    for (const letter of report.needsFailure.slice(0, 5)) {
      alertMessage += `- ${letter.title} (${letter.letter_type})\n`
    }
    if (report.needsFailure.length > 5) {
      alertMessage += `... and ${report.needsFailure.length - 5} more\n`
    }
  }

  alertMessage += `\nAction required: Please review the stuck letters and contact support if this persists.\n`
  alertMessage += `\nReview Center: ${siteUrl}/secure-admin-gateway/review`

  // Send admin alert email
  try {
    await queueTemplateEmail("admin-alert", adminEmail, {
      alertMessage,
      actionUrl: `${siteUrl}/secure-admin-gateway/review`,
      pendingReviews: report.total
    })
    console.log(`[StuckLetters] Sent admin alert to ${adminEmail}`)
  } catch (error) {
    console.error("[StuckLetters] Failed to send admin alert:", error)
  }
}
