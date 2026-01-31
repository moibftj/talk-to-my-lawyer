import { render } from '@react-email/render';
import LetterRejectedEmail from '../lib/email/react-email/LetterRejectedEmail.tsx';
import EmailConfirmationEmail from '../lib/email/react-email/EmailConfirmationEmail.tsx';
import fetch from 'node-fetch';
import React from 'react';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error('RESEND_API_KEY environment variable is not set.');
  process.exit(1);
}

const templates = [
  {
    name: 'Letter Rejected',
    subject: 'Action Required: Letter Needs Revision',
    component: LetterRejectedEmail,
  },
  {
    name: 'Email Confirmation',
    subject: 'Confirm Your Email Address - Talk-To-My-Lawyer',
    component: EmailConfirmationEmail,
  },
];

async function createTemplates() {
  for (const template of templates) {
    const Component = template.component.default || template.component;
    const html = render(React.createElement(Component));

    const response = await fetch('https://api.resend.com/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        name: template.name,
        subject: template.subject,
        html: String(html),
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
