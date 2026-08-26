import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'Winger'
const FROM_EMAIL = 'noreply@wingerapp.dev'
const RESEND_API_URL = 'https://api.resend.com/emails'

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const MAIN_APP_URL = 'https://wingerapp.dev'
const CANONICAL_APP_URL = (Deno.env.get('VITE_APP_URL') || MAIN_APP_URL).replace(/\/+$/, '')
const getRecoveryRedirectUrl = () => `${MAIN_APP_URL}/reset-password`

const normalizeConfirmationUrl = (emailType: string, rawUrl?: string): string => {
  if (!rawUrl) return CANONICAL_APP_URL
  try {
    const parsed = new URL(rawUrl)
    if (emailType === 'recovery') {
      if (parsed.searchParams.has('redirect_to')) {
        parsed.searchParams.set('redirect_to', getRecoveryRedirectUrl())
        return parsed.toString()
      }
    }
    return rawUrl
  } catch {
    return rawUrl
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders })
  }

  // Supabase Custom Email Hooks send data in this shape:
  // { user: { email: ... }, email_data: { email_action_type, token, redirect_to, ... } }
  const emailData = payload.email_data || payload.data || payload || {};
  const user = payload.user || {};
  
  const emailType = emailData.email_action_type || emailData.action_type || payload.type || 'signup';
  const recipientEmail = user.email || emailData.email || payload.email;
  const token = emailData.token;

  console.log(`Received email webhook for type: ${emailType}, to: ${recipientEmail}`);

  if (!recipientEmail) {
    return new Response(JSON.stringify({ error: 'Missing email in payload' }), { status: 400, headers: corsHeaders })
  }

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), { status: 400, headers: corsHeaders })
  }

  const confirmationUrl = normalizeConfirmationUrl(emailType, emailData.redirect_to || emailData.url)

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: CANONICAL_APP_URL,
    recipient: recipientEmail,
    confirmationUrl,
    token: token,
    email: recipientEmail,
    newEmail: emailData.new_email || user.new_email,
  }

  try {
    const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
    const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${SITE_NAME} <${FROM_EMAIL}>`,
        to: [recipientEmail],
        subject: EMAIL_SUBJECTS[emailType] || 'Notification',
        html,
        text
      })
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(JSON.stringify(data))
    }
    
    console.log('Email sent successfully!', { id: data.id });
    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    console.error('Email sending failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
