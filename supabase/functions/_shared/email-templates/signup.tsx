/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Winger — verify your email to get started</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>🛒 Winger</Text>
        </Section>
        <Heading style={h1}>Welcome aboard! 🎉</Heading>
        <Text style={text}>
          Thanks for joining{' '}
          <Link href={siteUrl} style={link}>
            <strong>Winger</strong>
          </Link>
          — the marketplace that connects vendors and affiliates across Africa.
        </Text>
        <Text style={text}>
          Verify your email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) to start selling or earning commissions:
        </Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            Get Started
          </Button>
        </Section>
        <Text style={footer}>
          If you didn't create an Winger account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logoText = { fontSize: '28px', fontWeight: 'bold' as const, color: '#E88C0E', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6B7280', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#E88C0E', textDecoration: 'underline' }
const buttonSection = { textAlign: 'center' as const, margin: '8px 0 28px' }
const button = { backgroundColor: '#E88C0E', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '16px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#9CA3AF', margin: '24px 0 0', borderTop: '1px solid #F3F4F6', paddingTop: '16px' }
