'use server';

import { sendReactEmail } from '@/lib/email/react-email-service';
import { sendTemplateEmail } from '@/lib/email/service';
import type { EmailTemplate, TemplateData } from '@/lib/email/types';

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Server Action: Send a welcome email to a new user
 */
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  actionUrl: string
): Promise<SendEmailResult> {
  try {
    const result = await sendReactEmail(
      'welcome',
      to,
      { userName, actionUrl },
      'Welcome to Talk-To-My-Lawyer!'
    );

    return {
      success: result.success,
      error: result.error,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Server Action: Send a password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetUrl: string
): Promise<SendEmailResult> {
  try {
    const result = await sendReactEmail(
      'password-reset',
      to,
      { userName, actionUrl: resetUrl },
      'Reset Your Password - Talk-To-My-Lawyer'
    );

    return {
      success: result.success,
      error: result.error,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Server Action: Send a letter approved notification
 */
export async function sendLetterApprovedEmail(
  to: string,
  userName: string,
  letterTitle: string,
  letterLink: string
): Promise<SendEmailResult> {
  try {
    const result = await sendReactEmail(
      'letter-approved',
      to,
      { userName, letterTitle, letterLink },
      `Your Letter Has Been Approved - ${letterTitle}`
    );

    return {
      success: result.success,
      error: result.error,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Failed to send letter approved email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Server Action: Send any template email (generic)
 */
export async function sendTemplateEmailAction(
  template: EmailTemplate,
  to: string | string[],
  data: TemplateData
): Promise<SendEmailResult> {
  try {
    const result = await sendTemplateEmail(template, to, data);

    return {
      success: result.success,
      error: result.error,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Failed to send template email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
