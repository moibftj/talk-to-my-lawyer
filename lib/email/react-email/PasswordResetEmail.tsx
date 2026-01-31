import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './EmailLayout';
import * as React from 'react';

interface PasswordResetEmailProps {
  userName?: string;
  actionUrl?: string;
  unsubscribeUrl?: string;
}

const PasswordResetEmail = ({ userName, actionUrl, unsubscribeUrl }: PasswordResetEmailProps) => (
  <EmailLayout title="Reset Your Password" unsubscribeUrl={unsubscribeUrl}>
    <Text>Hi {userName || 'there'},</Text>
    <Text>We received a request to reset your password. Click the button below to set a new password.</Text>
    <Section style={{ textAlign: 'center' }}>
      <Button style={button} href={actionUrl}>
        Reset Password
      </Button>
    </Section>
    <Text>If you did not request a password reset, please ignore this email.</Text>
  </EmailLayout>
);

export default PasswordResetEmail;

const button = {
  backgroundColor: '#1a1a2e',
  color: 'white',
  padding: '12px 24px',
  textDecoration: 'none',
  borderRadius: '6px',
  margin: '20px 0',
};
