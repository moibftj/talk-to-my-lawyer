/**
 * Admin Payout Management API
 *
 * GET: List all payout requests (filterable by status)
 * POST: Process a payout request (approve/reject/complete)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import { validateSystemAdminAction } from "@/lib/admin/letter-actions";
import { getRateLimitTuple } from "@/lib/config";
import { handleApiError } from "@/lib/api/api-error-handler";
import { requireSuperAdminAuth } from "@/lib/auth/admin-session";
import { createClient } from "@/lib/supabase/server";
import { queueTemplateEmail } from "@/lib/email/service";
import { PAYOUT_STATUSES } from "@/lib/constants/statuses";

export const runtime = "nodejs";

// GET - List all payout requests with employee info
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      adminRateLimit,
      ...getRateLimitTuple("ADMIN_READ"),
    );
    if (rateLimitResponse) return rateLimitResponse;

    const authError = await requireSuperAdminAuth();
    if (authError) return authError;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100,
    );
    const offset = (page - 1) * limit;

    let query = (supabase as any)
      .from("payout_requests")
      .select(
        `
        *,
        profiles:employee_id (
          id,
          email,
          full_name,
          role
        )
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && Object.values(PAYOUT_STATUSES).includes(status as any)) {
      query = query.eq("status", status);
    }

    const { data: payouts, count, error } = await query;

    if (error) {
      console.error("[AdminPayouts] Error fetching payouts:", error);
      return NextResponse.json(
        { error: "Failed to fetch payout requests" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      payouts: payouts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "AdminPayouts");
  }
}

// POST - Process a payout request (approve, reject, complete)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      adminRateLimit,
      ...getRateLimitTuple("ADMIN_WRITE"),
    );
    if (rateLimitResponse) return rateLimitResponse;

    const validationError = await validateSystemAdminAction(request);
    if (validationError) return validationError;

    const body = await request.json();
    const { payoutId, action, notes } = body;

    if (!payoutId) {
      return NextResponse.json(
        { error: "payoutId is required" },
        { status: 400 },
      );
    }

    const validActions = ["approve", "reject", "complete"] as const;
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Fetch current payout request with employee info
    const { data: payout, error: fetchError } = await (supabase as any)
      .from("payout_requests")
      .select(
        `
        *,
        profiles:employee_id (
          id,
          email,
          full_name
        )
      `,
      )
      .eq("id", payoutId)
      .single();

    if (fetchError || !payout) {
      return NextResponse.json(
        { error: "Payout request not found" },
        { status: 404 },
      );
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      approve: [PAYOUT_STATUSES.PENDING],
      reject: [PAYOUT_STATUSES.PENDING, PAYOUT_STATUSES.PROCESSING],
      complete: [PAYOUT_STATUSES.PROCESSING],
    };

    const allowed = validTransitions[action] || [];
    if (!allowed.includes(payout.status)) {
      return NextResponse.json(
        {
          error: `Cannot ${action} a payout with status '${payout.status}'. Requires: ${allowed.join(" or ")}`,
        },
        { status: 409 },
      );
    }

    // Determine new status
    const statusMap: Record<string, string> = {
      approve: PAYOUT_STATUSES.PROCESSING,
      reject: PAYOUT_STATUSES.REJECTED,
      complete: PAYOUT_STATUSES.COMPLETED,
    };

    const newStatus = statusMap[action];
    const now = new Date().toISOString();

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
      admin_notes: notes || null,
    };

    if (action === "complete") {
      updateData.paid_at = now;
    }

    if (action === "reject") {
      updateData.rejection_reason = notes || "Rejected by admin";
    }

    // Update payout request
    const { error: updateError } = await (supabase as any)
      .from("payout_requests")
      .update(updateData)
      .eq("id", payoutId);

    if (updateError) {
      console.error("[AdminPayouts] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update payout request" },
        { status: 500 },
      );
    }

    // If completing, mark the commissions as paid
    if (action === "complete") {
      await (supabase as any)
        .from("commissions")
        .update({ status: "paid", paid_at: now })
        .eq("employee_id", payout.employee_id)
        .eq("status", "pending")
        .lte("amount", payout.amount);
    }

    // Log admin action
    await (supabase as any).from("admin_audit_log").insert({
      admin_id: "system",
      action: `payout_${action}`,
      resource_type: "payout_request",
      resource_id: payoutId,
      changes: {
        old_status: payout.status,
        new_status: newStatus,
        amount: payout.amount,
        notes,
      },
    });

    // Send notification email to employee
    const profile = payout.profiles as any;
    if (profile?.email) {
      const templateMap: Record<string, string> = {
        approve: "payout-approved",
        reject: "payout-rejected",
        complete: "payout-completed",
      };

      try {
        await queueTemplateEmail(templateMap[action] as any, profile.email, {
          userName: profile.full_name || "there",
          payoutAmount: payout.amount,
          payoutStatus: newStatus,
          notes: notes || undefined,
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/dashboard/payouts`,
        });
      } catch (emailError) {
        console.error("[AdminPayouts] Email notification failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payout request ${action}${action === "complete" ? "d" : action === "reject" ? "ed" : "d"} successfully`,
      payout: {
        id: payoutId,
        status: newStatus,
        amount: payout.amount,
      },
    });
  } catch (error) {
    return handleApiError(error, "AdminPayouts");
  }
}
