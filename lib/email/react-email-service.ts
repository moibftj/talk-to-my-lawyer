import { render } from '@react-email/render';
import { createElement } from 'react';
import type { EmailMessage, EmailResult } from './types';
import { getEmailService } from './service';

// Import all React Email components
import WelcomeEmail from './react-email/WelcomeEmail';
import PasswordResetEmail from './react-email/PasswordResetEmail';
import LetterApprovedEmail from './react-email/LetterApprovedEmail';

interface ReactEmailProps {
  userName?: string;
  actionUrl?: string;
  letterTitle?: string;
  letterLink?: string;
  unsubscribeUrl?: string;
  [key: string]: any;
}

type ReactEmailComponent = React.ComponentType<ReactEmailProps>;

const emailComponents: Record<string, ReactEmailComponent> = {
  welcome: WelcomeEmail,
  'password-reset': PasswordResetEmail,
  'letter-approved': LetterApprovedEmail,
};

/**
 * Send an email using a React Email component
 */
export async function sendReactEmail(
  templateName: string,
  to: string | string[],
  props: ReactEmailProps,
  subject?: string
): Promise<EmailResult> {
  const Component = emailComponents[templateName];

  if (!Component) {
    throw new Error(`React Email component not found: ${templateName}`);
  }

  // Render the React component to HTML
  const html = render(createElement(Component, props));

  // Create the email message
  const message: EmailMessage = {
    to,
    subject: subject || `Notification from Talk-To-My-Lawyer`,
    html,
  };

  // Send using the existing email service
  const emailService = getEmailService();
  return emailService.send(message);
}

/**
 * Render a React Email component to HTML string (useful for testing)
 */
export function renderReactEmail(
  templateName: string,
  props: ReactEmailProps
): string {
  const Component = emailComponents[templateName];

  if (!Component) {
    throw new Error(`React Email component not found: ${templateName}`);
  }

  return render(createElement(Component, props));
}
