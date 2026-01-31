import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './EmailLayout';
import * as React from 'react';

interface LetterRejectedEmailProps {
  userName?: string;
  letterTitle?: string;
  letterLink?: string;
  rejectionReason?: string;
  unsubscribeUrl?: string;
}

const LetterRejectedEmail = ({ 
  userName, 
  letterTitle, 
  letterLink, 
  rejectionReason,
  unsubscribeUrl 
}: LetterRejectedEmailProps) => (
  <EmailLayout title="Your Letter Needs Revision" unsubscribeUrl={unsubscribeUrl}>
    <Text>Hi {userName || 'there'},</Text>
    <Text>Your letter, "{letterTitle}", requires some changes before it can be approved.</Text>
    {rejectionReason && (
      <Section style={highlightBox}>
        <Text style={{ margin: 0 }}><strong>Feedback:</strong></Text>
        <Text style={{ margin: '10px 0 0 0' }}>{rejectionReason}</Text>
      </Section>
    )}
    <Section style={{ textAlign: 'center' }}>
      <Button style={button} href={letterLink}>
        Review Feedback
      </Button>
    </Section>
    <Text>Please make the necessary revisions and resubmit your letter for review.</Text>
  </EmailLayout>
);

export default LetterRejectedEmail;

const button = {
  backgroundColor: '#1a1a2e',
  color: 'white',
  padding: '12px 24px',
  textDecoration: 'none',
  borderRadius: '6px',
  margin: '20px 0',
};

const highlightBox = {
  backgroundColor: '#f0f9ff',
  padding: '15px',
  borderLeft: '4px solid #0284c7',
  margin: '20px 0',
};
