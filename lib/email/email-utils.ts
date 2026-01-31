import type { EmailTemplate, TemplateData } from './types';

/**
 * Get the site URL from environment variables
 */
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://talk-to-my-lawyer.com'
  );
}

/**
 * Generate an unsubscribe URL for a given email address
 */
export function generateUnsubscribeUrl(email: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}`;
}

/**
 * Generate a confirmation URL with a token
 */
export function generateConfirmationUrl(token: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/auth/confirm?token=${token}`;
}

/**
 * Generate a password reset URL with a token
 */
export function generatePasswordResetUrl(token: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/auth/reset-password?token=${token}`;
}

/**
 * Generate a letter view URL
 */
export function generateLetterUrl(letterId: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/letters/${letterId}`;
}

/**
 * Generate a dashboard URL
 */
export function generateDashboardUrl(): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/dashboard`;
}

/**
 * Check if an email template requires an unsubscribe link
 */
export function requiresUnsubscribeLink(template: EmailTemplate): boolean {
  const marketingTemplates: EmailTemplate[] = [
    'welcome',
    'subscription-confirmation',
    'subscription-renewal',
    'subscription-cancelled',
    'commission-earned',
    'commission-paid',
    'free-trial-ending',
    'onboarding-complete',
    'letter-generated',
    'letter-approved',
    'letter-rejected',
    'letter-under-review',
  ];
  return marketingTemplates.includes(template);
}

/**
 * Enhance template data with common fields
 */
export function enhanceTemplateData(
  data: TemplateData,
  recipientEmail?: string
): TemplateData {
  const enhanced = { ...data };

  // Add site URL if not present
  if (!enhanced.siteUrl) {
    enhanced.siteUrl = getSiteUrl();
  }

  // Add unsubscribe URL if recipient email is provided
  if (recipientEmail && !enhanced.unsubscribeUrl) {
    enhanced.unsubscribeUrl = generateUnsubscribeUrl(recipientEmail);
  }

  return enhanced;
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate multiple email addresses
 */
export function validateEmails(emails: string | string[]): boolean {
  const emailArray = Array.isArray(emails) ? emails : [emails];
  return emailArray.every(isValidEmail);
}

/**
 * Format email address with name
 */
export function formatEmailAddress(email: string, name?: string): string {
  if (name) {
    return `${name} <${email}>`;
  }
  return email;
}
