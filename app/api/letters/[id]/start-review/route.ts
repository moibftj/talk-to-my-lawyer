import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth/admin-session";
import { validateAdminAction } from "@/lib/admin/letter-actions";
import { adminRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import {
  errorResponses,
  handleApiError,
  successResponse,
} from "@/lib/api/api-error-handler";
import { getRateLimitTuple } from "@/lib/config";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      adminRateLimit,
      ...getRateLimitTuple("ADMIN_WRITE"),
    );
    if (rateLimitResponse) return rateLimitResponse;

    const validationError = await validateAdminAction(request);
    if (validationError) return validationError;

    const { id } = await params;
    const supabase = await createClient();
    const adminSession = await getAdminSession();

    const { data: letter } = await supabase
      .from("letters")
      .select("status")
      .eq("id", id)
      .single();

    if (!letter) {
      return errorResponses.notFound("Letter");
    }

    // Only pending_review letters can be moved to under_review
    if (letter.status !== "pending_review") {
      return errorResponses.validation(
        `Cannot start review: letter is '${letter.status}', must be 'pending_review'`,
      );
    }

    const { error: updateError } = await supabase
      .from("letters")
      .update({
        status: "under_review",
        reviewed_by: adminSession?.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;

    await (supabase as any).rpc("log_letter_audit", {
      p_letter_id: id,
      p_action: "review_started",
      p_old_status: letter.status,
      p_new_status: "under_review",
      p_notes: "Admin started reviewing the letter",
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error, "Start Review");
  }
}
