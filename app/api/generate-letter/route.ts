import { type NextRequest } from "next/server";
import {
  letterGenerationRateLimit,
  safeApplyRateLimit,
} from "@/lib/rate-limit-redis";
import { validateLetterGenerationRequest } from "@/lib/validation/letter-schema";
import {
  successResponse,
  errorResponses,
  handleApiError,
} from "@/lib/api/api-error-handler";
import { requireSubscriber } from "@/lib/auth/authenticate-user";
import { getRateLimitTuple } from "@/lib/config";
import {
  checkAndDeductAllowance,
  refundLetterAllowance,
} from "@/lib/services/allowance-service";
import { logLetterStatusChange } from "@/lib/services/audit-service";
import {
  isN8nConfigured,
  generateLetterViaN8n,
  transformIntakeToN8nFormat,
} from "@/lib/services/n8n-webhook-service";
import { generateLetterContent } from "@/lib/services/letter-generation-service";
import { getStateName } from "@/lib/validation/letter-schema";
import { notifyAdminsNewLetter } from "@/lib/services/notification-service";
import type { LetterGenerationResponse } from "@/lib/types/letter.types";
import {
  createBusinessSpan,
  addSpanAttributes,
  recordSpanEvent,
} from "@/lib/monitoring/tracing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const span = createBusinessSpan("generate_letter", {
    "http.method": "POST",
    "http.route": "/api/generate-letter",
  });

  let letterId: string | null = null;
  let isFreeTrial = false;
  let isSuperAdmin = false;
  let supabaseClient: any = null;
  let user: any = null;

  try {
    recordSpanEvent("letter_generation_started");

    const n8nAvailable = isN8nConfigured();

    addSpanAttributes({
      "generation.method": "n8n",
      "generation.n8n_available": n8nAvailable,
    });

    const rateLimitResponse = await safeApplyRateLimit(
      request,
      letterGenerationRateLimit,
      ...getRateLimitTuple("LETTER_GENERATE"),
    );
    if (rateLimitResponse) {
      recordSpanEvent("rate_limit_exceeded");
      span.setStatus({ code: 2, message: "Rate limit exceeded" });
      return rateLimitResponse;
    }

    const auth = await requireSubscriber();
    user = auth.user;
    supabaseClient = auth.supabase;
    const supabase = auth.supabase;

    addSpanAttributes({
      "user.id": user.id,
      "user.email": user.email || "unknown",
    });
    recordSpanEvent("user_authenticated", { user_id: user.id });

    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(
        "[GenerateLetter] Failed to parse request body:",
        parseError,
      );
      return errorResponses.validation("Invalid JSON in request body");
    }

    const { letterType, intakeData } = body;

    if (!letterType || typeof letterType !== "string") {
      return errorResponses.validation(
        "letterType is required and must be a string",
      );
    }

    if (!intakeData || typeof intakeData !== "object") {
      return errorResponses.validation(
        "intakeData is required and must be an object",
      );
    }

    const validation = validateLetterGenerationRequest(letterType, intakeData);
    if (!validation.valid) {
      console.error("[GenerateLetter] Validation failed:", validation.errors);
      return errorResponses.validation("Invalid input data", validation.errors);
    }

    const sanitizedLetterType = letterType.trim();
    const sanitizedIntakeData = validation.data!;

    addSpanAttributes({
      "letter.type": sanitizedLetterType,
      "letter.sender_state": String(
        sanitizedIntakeData.senderState || "unknown",
      ),
      "letter.recipient_state": String(
        sanitizedIntakeData.recipientState || "unknown",
      ),
    });

    if (!n8nAvailable) {
      console.error("[GenerateLetter] n8n is not configured.");
      return errorResponses.serverError(
        "Letter generation service is temporarily unavailable. Please try again later.",
      );
    }

    const deductionResult = await checkAndDeductAllowance(user.id);

    if (!deductionResult.success) {
      console.log(
        "[GenerateLetter] Allowance check failed:",
        deductionResult.errorMessage,
      );
      return errorResponses.validation(
        deductionResult.errorMessage || "No letter credits remaining",
        { needsSubscription: true, code: "INSUFFICIENT_CREDITS" },
      );
    }

    isFreeTrial = deductionResult.isFreeTrial || false;
    isSuperAdmin = deductionResult.isSuperAdmin || false;

    addSpanAttributes({
      "user.is_free_trial": isFreeTrial,
      "user.is_super_admin": isSuperAdmin,
    });

    const letterTitle = `${sanitizedLetterType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} - ${new Date().toLocaleDateString()}`;

    const { data: newLetter, error: insertError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        letter_type: sanitizedLetterType,
        title: letterTitle,
        intake_data: sanitizedIntakeData,
        status: "generating",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, title, letter_type, status, created_at")
      .single();

    if (insertError || !newLetter) {
      console.error("[GenerateLetter] Database insert failed:", insertError);

      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1).catch((err) => {
          console.error("[GenerateLetter] Failed to refund allowance:", err);
        });
      }

      return errorResponses.serverError(
        "Failed to create letter record. Please try again.",
      );
    }

    letterId = newLetter.id;
    console.log(`[GenerateLetter] Created letter record: ${letterId}`);
    recordSpanEvent("letter_record_created", { letter_id: letterId! });

    try {
      console.log(
        `[GenerateLetter] Using n8n workflow for letter: ${letterId}`,
      );
      recordSpanEvent("n8n_generation_started");

      const n8nFormData = transformIntakeToN8nFormat(
        letterId!,
        user.id,
        sanitizedLetterType,
        sanitizedIntakeData as Record<string, unknown>,
      );

      const n8nResult = await generateLetterViaN8n(n8nFormData);

      if (!n8nResult.success) {
        throw new Error(
          n8nResult.error || "n8n workflow returned unsuccessful result",
        );
      }

      console.log(
        `[GenerateLetter] n8n generation successful for letter: ${letterId}`,
        {
          supabaseUpdated: n8nResult.supabaseUpdated,
          status: n8nResult.status,
        },
      );
      recordSpanEvent("n8n_generation_completed", {
        letter_id: letterId!,
        supabase_updated: n8nResult.supabaseUpdated,
      });
    } catch (n8nError) {
      const n8nErrorMessage =
        n8nError instanceof Error ? n8nError.message : "Unknown n8n error";
      console.error(
        `[GenerateLetter] n8n generation failed for letter ${letterId}:`,
        n8nErrorMessage,
      );
      recordSpanEvent("n8n_generation_failed", { error: n8nErrorMessage });

      // FALLBACK: Try OpenAI direct generation
      console.log(
        `[GenerateLetter] Falling back to OpenAI direct generation for letter: ${letterId}`,
      );
      recordSpanEvent("openai_fallback_started");

      try {
        // Generate letter content using OpenAI
        const aiDraftContent = await generateLetterContent(
          sanitizedLetterType,
          sanitizedIntakeData as Record<string, unknown>,
        );

        if (!aiDraftContent) {
          throw new Error("OpenAI returned empty content");
        }

        // Update letter with AI draft content
        const { error: updateError } = await supabase
          .from("letters")
          .update({
            ai_draft_content: aiDraftContent,
            status: "pending_review",
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            generation_metadata: {
              method: "openai_fallback",
              n8n_error: n8nErrorMessage,
              model: "gpt-4o",
              timestamp: new Date().toISOString(),
            },
          })
          .eq("id", letterId);

        if (updateError) {
          console.error(
            "[GenerateLetter] Failed to update letter with OpenAI content:",
            updateError,
          );
          throw updateError;
        }

        console.log(
          `[GenerateLetter] OpenAI fallback successful for letter: ${letterId}`,
        );
        recordSpanEvent("openai_fallback_completed", { letter_id: letterId! });

        // Log audit trail
        await logLetterStatusChange(
          supabase,
          letterId!,
          "generating",
          "pending_review",
          "created",
          `Letter generated via OpenAI fallback (n8n unavailable)`,
        ).catch((err) => {
          console.warn(
            "[GenerateLetter] Audit log failed (non-critical):",
            err,
          );
        });

        // Notify admins
        notifyAdminsNewLetter(
          letterId!,
          letterTitle,
          sanitizedLetterType,
        ).catch((err) => {
          console.warn(
            "[GenerateLetter] Admin notification failed (non-critical):",
            err,
          );
        });

        recordSpanEvent("admin_notification_queued");

        span.setStatus({ code: 1 });

        return successResponse<LetterGenerationResponse>({
          success: true,
          letterId: letterId!,
          status: "pending_review",
          isFreeTrial: isFreeTrial,
          aiDraft: undefined,
        });
      } catch (fallbackError) {
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : "Unknown fallback error";
        console.error(
          `[GenerateLetter] OpenAI fallback also failed for letter ${letterId}:`,
          fallbackErrorMessage,
        );
        recordSpanEvent("openai_fallback_failed", {
          error: fallbackErrorMessage,
        });

        // Both n8n and OpenAI failed - mark as failed and refund
        await supabase
          .from("letters")
          .update({
            status: "failed",
            generation_error: `Both n8n and OpenAI failed. n8n: ${n8nErrorMessage}, OpenAI: ${fallbackErrorMessage}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", letterId);

        if (!isFreeTrial && !isSuperAdmin) {
          await refundLetterAllowance(user.id, 1).catch((err) => {
            console.error("[GenerateLetter] Failed to refund allowance:", err);
          });
        }

        return errorResponses.serverError(
          "Failed to generate letter. Your credit has been refunded. Please try again.",
        );
      }
    }

    // n8n workflow already updated Supabase directly with:
    // status=pending_review, ai_draft_content, subject, statutes_cited,
    // legal_basis, next_steps, delivery_instructions, generated_at, updated_at
    console.log(
      `[GenerateLetter] Letter ${letterId} saved by n8n workflow (Supabase updated directly)`,
    );

    recordSpanEvent("letter_saved_to_database", {
      status: "pending_review",
      method: "n8n",
    });

    await logLetterStatusChange(
      supabase,
      letterId!,
      "generating",
      "pending_review",
      "created",
      `Letter generated via n8n with jurisdiction research`,
    ).catch((err) => {
      console.warn("[GenerateLetter] Audit log failed (non-critical):", err);
    });

    notifyAdminsNewLetter(letterId!, letterTitle, sanitizedLetterType).catch(
      (err) => {
        console.warn(
          "[GenerateLetter] Admin notification failed (non-critical):",
          err,
        );
      },
    );

    recordSpanEvent("admin_notification_queued");

    span.setStatus({ code: 1 });

    return successResponse<LetterGenerationResponse>({
      success: true,
      letterId: letterId!,
      status: "pending_review",
      isFreeTrial: isFreeTrial,
      aiDraft: undefined,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[GenerateLetter] Unexpected error:", errorMessage);

    span.recordException(error as Error);
    span.setStatus({ code: 2, message: errorMessage });
    recordSpanEvent("letter_generation_error", { error: errorMessage });

    if (letterId && supabaseClient) {
      await supabaseClient
        .from("letters")
        .update({
          status: "failed",
          generation_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", letterId)
        .catch(() => {});

      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1).catch((refundError) => {
          console.error(
            "[GenerateLetter] Failed to refund allowance for user:",
            user.id,
            refundError
          );
        });
      }
    }

    return handleApiError(error, "GenerateLetter");
  } finally {
    span.end();
  }
}

export async function GET() {
  const n8nAvailable = isN8nConfigured();

  return successResponse({
    endpoint: "/api/generate-letter",
    method: "POST",
    description:
      "Generate a professional legal letter with jurisdiction research (n8n only)",
    generationMethod: "n8n",
    n8nConfigured: n8nAvailable,
    requiredFields: {
      letterType:
        "string - Type of letter (e.g., demand_letter, cease_and_desist)",
      intakeData: {
        senderName: "string - Full name of sender",
        senderAddress: "string - Full address of sender",
        senderState: "string - Two-letter state code (e.g., FL for Florida)",
        recipientName: "string - Full name of recipient",
        recipientAddress: "string - Full address of recipient",
        recipientState: "string - Two-letter state code",
        issueDescription: "string - Description of the legal issue",
        desiredOutcome: "string - What outcome the sender wants",
      },
    },
    optionalFields: {
      "intakeData.amountDemanded":
        "number - Amount being demanded (for demand letters)",
      "intakeData.deadlineDate": "string - Deadline for response",
      "intakeData.incidentDate": "string - Date of incident",
      "intakeData.additionalDetails": "string - Any additional context",
    },
    flow: [
      "1. User submits letter form data via POST",
      "2. System validates input and checks user allowance",
      "3. n8n researches jurisdiction (state statutes, disclosures, conventions)",
      "4. n8n generates letter with research context via GPT-4o",
      '5. Letter saved with status "pending_review"',
      "6. Admins notified for review",
      "7. Letter appears in Admin Review Center",
    ],
  });
}
