import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './EmailLayout';
import * as React from 'react';

interface LetterApprovedEmailProps {
  userName?: string;
  letterTitle?: string;
  letterLink?: string;
  unsubscribeUrl?: string;
}

const LetterApprovedEmail = ({ userName, letterTitle, letterLink, unsubscribeUrl }: LetterApprovedEmailProps) => (
  <EmailLayout title="Your Letter Has Been Approved!" unsubscribeUrl={unsubscribeUrl}>
    <Text>Hi {userName || 'there'},</Text>
    <Text>Good news! Your letter, "{letterTitle}", has been reviewed and approved by our legal team.</Text>
    <Section style={{ textAlign: 'center' }}>
      <Button style={button} href={letterLink}>
        View Your Letter
      </Button>
    </Section>
    <Text>You can now download the letter as a PDF and send it to the recipient.</Text>
  </EmailLayout>
);

export default LetterApprovedEmail;

const button = {
  backgroundColor: '#1a1a2e',
  color: 'white',
  padding: '12px 24px',
  textDecoration: 'none',
  borderRadius: '6px',
  margin: '20px 0',
};
