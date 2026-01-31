import { render } from '@react-email/render';
import WelcomeEmail from '../lib/email/react-email/WelcomeEmail.tsx';
import PasswordResetEmail from '../lib/email/react-email/PasswordResetEmail.tsx';
import LetterApprovedEmail from '../lib/email/react-email/LetterApprovedEmail.tsx';
import fetch from 'node-fetch';
import React from 'react';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error('RESEND_API_KEY environment variable is not set.');
  process.exit(1);
}

const templates = [
  {
    name: 'Welcome',
    subject: 'Welcome to Talk-To-My-Lawyer!',
    component: WelcomeEmail,
  },
  {
    name: 'Password Reset',
    subject: 'Reset Your Password',
    component: PasswordResetEmail,
  },
  {
    name: 'Letter Approved',
    subject: 'Your Letter Has Been Approved!',
    component: LetterApprovedEmail,
  },
];

async function createTemplates() {
  for (const template of templates) {
    const Component = template.component.default || template.component;
    const html = render(React.createElement(Component));
    console.log(`Rendered HTML for ${template.name} is of type: ${typeof html}`);

    const response = await fetch('https://api.resend.com/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        name: template.name,
        subject: template.subject,
        html: String(html), // Explicitly cast to string
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`Successfully created template: ${template.name} (ID: ${data.id})`);
    } else {
      console.error(`Failed to create template: ${template.name}`);
      console.error(data);
    }

    // Add a 1-second delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

createTemplates();
