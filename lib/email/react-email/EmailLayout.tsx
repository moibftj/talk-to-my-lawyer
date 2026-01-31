import { Html, Head, Body, Container, Heading, Text, Link, Section } from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  children: React.ReactNode;
  title: string;
  unsubscribeUrl?: string;
}

export const EmailLayout = ({ children, title, unsubscribeUrl }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>Talk-To-My-Lawyer</Heading>
          </Section>
          <Section style={content}>
            <Heading as="h2" style={titleStyle}>{title}</Heading>
            {children}
          </Section>
          <Section style={footer}>
            <Text style={footerText}>123 Legal Street, Suite 100, San Francisco, CA 94102</Text>
            {unsubscribeUrl && (
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const header = {
  backgroundColor: '#1a1a2e',
  padding: '20px',
  color: 'white',
  textAlign: 'center' as const,
};

const heading = {
  fontSize: '24px',
  margin: '0',
};

const content = {
  padding: '20px',
};

const titleStyle = {
  fontSize: '20px',
  fontWeight: 'bold',
  marginBottom: '20px',
};

const footer = {
  padding: '20px',
  textAlign: 'center' as const,
  fontSize: '12px',
  color: '#666',
};

const footerText = {
  margin: '0',
};

const footerLink = {
  color: '#666',
  textDecoration: 'underline',
  marginLeft: '10px',
};
