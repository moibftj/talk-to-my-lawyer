import { NextRequest, NextResponse } from "next/server";
import { sendReactEmail } from "@/lib/email/react-email-service";
import { sendTemplateEmail } from "@/lib/email/service";
import type { EmailTemplate, TemplateData } from "@/lib/email/types";
import { requireAdmin } from "@/lib/auth/authenticate-user";
import { adminRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import { handleApiError } from "@/lib/api/api-error-handler";

interface SendEmailRequest {
  type: "react" | "template";
  templateName: string;
  to: string | string[];
  subject?: string;
  data: TemplateData;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      adminRateLimit,
      10,
      "1 m",
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Auth: only admins can send arbitrary emails
    await requireAdmin();

    const body: SendEmailRequest = await request.json();

    // Validate required fields
    if (!body.templateName || !body.to || !body.data) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: templateName, to, data",
        },
        { status: 400 },
      );
    }

    let result;

    if (body.type === "react") {
      // Send using React Email components
      result = await sendReactEmail(
        body.templateName,
        body.to,
        body.data,
        body.subject,
      );
    } else {
      // Send using traditional templates
      result = await sendTemplateEmail(
        body.templateName as EmailTemplate,
        body.to,
        body.data,
      );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }
  } catch (error) {
    return handleApiError(error, "Email Send");
  }
}
