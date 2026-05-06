/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Winger verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>🛒 Winger</Text>
        </Section>
        <Heading style={h1}>Verification code</Heading>
        <Text style={text}>Use the code below to verify your identity:</Text>
        <Section style={codeSection}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          This code expires shortly. If you didn't request this, you can safely
          ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logoText = { fontSize: '28px', fontWeight: 'bold' as const, color: '#E88C0E', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6B7280', lineHeight: '1.6', margin: '0 0 20px' }
const codeSection = { textAlign: 'center' as const, margin: '8px 0 28px', backgroundColor: '#FEF3C7', borderRadius: '12px', padding: '16px' }
const codeStyle = { fontFamily: "'Courier New', Courier, monospace", fontSize: '32px', fontWeight: 'bold' as const, color: '#0F172A', letterSpacing: '6px', margin: '0' }
const footer = { fontSize: '12px', color: '#9CA3AF', margin: '24px 0 0', borderTop: '1px solid #F3F4F6', paddingTop: '16px' }
