// Email-client-safe HTML (Gmail, Outlook, Apple Mail): table layout, inline
// styles only, no web fonts or external CSS — Gmail strips <style> blocks in
// many contexts. Colours mirror the frontend's theme tokens (globals.css).
const COLORS = {
  page: '#fbf6ec',
  card: '#ffffff',
  heading: '#1b3b2b',
  body: '#6b6a63',
  subtle: '#7a8984',
  border: '#dce6d9',
  primary: '#e4ee50',
};

export type OtpPurpose = 'signup' | 'password-reset' | 'contact-change';

const COPY: Record<
  OtpPurpose,
  { preheader: string; title: string; intro: string; ignore: string }
> = {
  signup: {
    preheader: 'Your Paddykonect verification code',
    title: 'Verify your email',
    intro:
      'Welcome to Paddykonect! Enter this code in the app to finish creating your account.',
    ignore:
      "If you didn't sign up for Paddykonect, you can safely ignore this email.",
  },
  'password-reset': {
    preheader: 'Your Paddykonect password reset code',
    title: 'Reset your password',
    intro:
      'We received a request to reset your password. Enter this code in the app to choose a new one.',
    ignore:
      "If you didn't ask to reset your password, you can ignore this email — your password won't change.",
  },
  'contact-change': {
    preheader: 'Confirm your new Paddykonect contact details',
    title: 'Confirm your new details',
    intro:
      'You asked to change the phone number or email on your Paddykonect account. Enter this code in the app to save the change.',
    ignore:
      "If you didn't ask for this, you can ignore this email — nothing on your account will change.",
  },
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function renderOtpEmail(
  code: string,
  purpose: OtpPurpose,
  expiresInMinutes: number,
): { html: string; text: string } {
  const copy = COPY[purpose];
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${copy.title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${copy.preheader}: ${code}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.page};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td align="center" style="padding:0 0 20px;font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.3px;color:${COLORS.heading};">
            Paddykonect
          </td>
        </tr>
        <tr>
          <td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;padding:32px 28px;">
            <h1 style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:700;color:${COLORS.heading};">${copy.title}</h1>
            <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;line-height:23px;color:${COLORS.body};">${copy.intro}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background-color:${COLORS.primary};border-radius:12px;padding:18px 12px;font-family:'SF Mono', Menlo, Consolas, 'Courier New', monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:${COLORS.heading};">${code}</td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${COLORS.body};">This code expires in <strong style="color:${COLORS.heading};">${expiresInMinutes} minutes</strong>. Never share it with anyone — Paddykonect will never ask you for it.</p>
            <hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0;">
            <p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${COLORS.subtle};">${copy.ignore}</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${COLORS.subtle};">
            Discover hangouts and connect with new padis in Lagos.<br>&copy; ${year} Paddykonect
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    copy.title,
    '',
    copy.intro,
    '',
    `Your code: ${code}`,
    '',
    `This code expires in ${expiresInMinutes} minutes. Never share it with anyone.`,
    '',
    copy.ignore,
    '',
    '— Paddykonect',
  ].join('\n');

  return { html, text };
}
