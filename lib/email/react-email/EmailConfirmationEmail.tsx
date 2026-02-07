import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './EmailLayout';
import * as React from 'react';

interface EmailConfirmationEmailProps {
  userName?: string;
  actionUrl?: string;
  unsubscribeUrl?: string;
}

const EmailConfirmationEmail = ({ userName, actionUrl, unsubscribeUrl }: EmailConfirmationEmailProps) => (
  <EmailLayout title="Confirm Your Email Address" unsubscribeUrl={unsubscribeUrl}>
    <Text>Hi {userName || 'there'},</Text>
    <Text>Please confirm your email address to complete your registration with Talk-to-my-Lawyer.</Text>
    <Section style={{ textAlign: 'center' }}>
      <Button style={button} href={actionUrl}>
        Confirm Email Address
      </Button>
    </Section>
    <Text style={{ fontSize: '12px', color: '#666' }}>
      If you didn't create an account with us, you can safely ignore this email. This link will expire in 24 hours.
    </Text>
  </EmailLayout>
);

export default EmailConfirmationEmail;

const button = {
  backgroundColor: '#1a1a2e',
  color: 'white',
  padding: '12px 24px',
  textDecoration: 'none',
  borderRadius: '6px',
  margin: '20px 0',
};
