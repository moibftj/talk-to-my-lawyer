import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getEmailService } from '@/lib/email'
import { generateLetterPdf } from '@/lib/pdf'
import { apiRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { sanitizeEmail, sanitizeString } from '@/lib/security/input-sanitizer'

type LetterRecord = {
  id: string
  title: string
  status: string
  final_content: string | null
  ai_draft_content: string | null
  intake_data: Record<string, unknown> | null
  created_at: string
  approved_at: string | null
  profiles?: {
    full_name?: string | null
    email?: string | null
  } | null
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_') || 'letter'
}

function extractParties(letter: LetterRecord): {
  sender: { name: string; address?: string }
  recipient: { name: string; address?: string; company?: string }
} {
  const intake = letter.intake_data || {}

  return {
    sender: {
      name: letter.profiles?.full_name || (intake.senderName as string) || 'Sender',
      address: intake.senderAddress as string | undefined,
    },
    recipient: {
      name: (intake.recipientName as string) || 'Recipient',
      address: intake.recipientAddress as string | undefined,
      company: intake.recipientCompany as string | undefined,
    },
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, '1 m')
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recipientEmail, message } = body

    const emailService = getEmailService()
    if (!emailService.isConfigured()) {
      return NextResponse.json({
        error: 'Email service is not configured'
      }, { status: 500 })
    }

    const { data: letter, error: letterError } = await supabase
      .from('letters')
      .select('*, profiles(full_name, email)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single<LetterRecord>()

    if (letterError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    if (letter.status !== 'approved' && letter.status !== 'completed') {
      return NextResponse.json({ error: 'Only approved letters can be sent' }, { status: 400 })
    }

    if (!recipientEmail || typeof recipientEmail !== 'string') {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    const sanitizedRecipientEmail = sanitizeEmail(recipientEmail)
    if (!sanitizedRecipientEmail) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 })
    }

    const parties = extractParties(letter)
    const content = letter.final_content || letter.ai_draft_content || ''

    const pdfResult = generateLetterPdf({
      id: letter.id,
      title: letter.title,
      content,
      parties,
      createdAt: letter.created_at,
      approvedAt: letter.approved_at || undefined,
      isDraft: false,
    }, {
      showLetterhead: true,
      showWatermark: false,
    })

    if (!pdfResult.success || !pdfResult.buffer) {
      console.error('[SendEmail] PDF generation failed:', pdfResult.error)
      return NextResponse.json({
        error: 'Failed to generate PDF attachment'
      }, { status: 500 })
    }

    const safeTitle = sanitizeFileName(letter.title)
    const letterOwner = letter.profiles?.full_name || 'Your legal team'
    const sanitizedMessage = message ? sanitizeString(message.toString(), 2000) : ''
    const customMessage = sanitizedMessage || 'Please review the attached approved letter.'

    const emailResult = await emailService.send({
      to: sanitizedRecipientEmail,
      subject: `Legal Letter: ${letter.title}`,
      text: `${customMessage}\n\nLetter prepared by ${letterOwner}.\nTitle: ${letter.title}\n\nThe reviewed letter is attached as a PDF.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Talk-To-My-Lawyer</h2>
          </div>
          <div style="padding: 30px; background: #ffffff; border: 1px solid #e0e0e0;">
            <p>${customMessage}</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Letter Title:</strong> ${letter.title}</p>
              <p style="margin: 10px 0 0 0;"><strong>Prepared by:</strong> ${letterOwner}</p>
              <p style="margin: 10px 0 0 0;"><strong>Date:</strong> ${new Date(letter.created_at).toLocaleDateString()}</p>
            </div>
            <p>The reviewed letter is attached as a PDF for your records.</p>
          </div>
          <div style="padding: 20px; background: #f5f5f5; text-align: center; font-size: 12px; color: #666;">
            <p>Talk-To-My-Lawyer | Professional Legal Letter Services</p>
          </div>
        </div>
      `,
      attachments: [
        {
          content: pdfResult.buffer.toString('base64'),
          filename: `${safeTitle}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    })

    if (!emailResult.success) {
      console.error('[SendEmail] Email send failed:', emailResult.error)
      return NextResponse.json({
        error: emailResult.error || 'Failed to send email'
      }, { status: 502 })
    }

    try {
      await supabase.rpc('log_letter_audit', {
        p_letter_id: letter.id,
        p_action: 'email_sent',
        p_old_status: letter.status,
        p_new_status: letter.status,
        p_notes: `Letter emailed to ${sanitizedRecipientEmail}`,
      })
    } catch (err) {
      console.warn('[SendEmail] Audit log failed:', err)
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
    })
  } catch (error) {
    console.error('[SendEmail] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
