import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './EmailLayout';
import * as React from 'react';

interface WelcomeEmailProps {
  userName?: string;
  actionUrl?: string;
  unsubscribeUrl?: string;
}

const WelcomeEmail = ({ userName, actionUrl, unsubscribeUrl }: WelcomeEmailProps) => (
  <EmailLayout title="Welcome to Talk-to-my-Lawyer!" unsubscribeUrl={unsubscribeUrl}>
    <Text>Hi {userName || 'there'},</Text>
    <Text>Thank you for signing up. You now have access to professional legal letter generation services with attorney review.</Text>
    <Section style={{ textAlign: 'center' }}>
      <Button style={button} href={actionUrl}>
        Go to your Dashboard
      </Button>
    </Section>
    <Text>Your first letter is free!</Text>
  </EmailLayout>
);

export default WelcomeEmail;

const button = {
  backgroundColor: '#1a1a2e',
  color: 'white',
  padding: '12px 24px',
  textDecoration: 'none',
  borderRadius: '6px',
  margin: '20px 0',
};
