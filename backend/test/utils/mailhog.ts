const MAILHOG_API = 'http://localhost:8025/api';

export async function clearMailhog(): Promise<void> {
  await fetch(`${MAILHOG_API}/v1/messages`, { method: 'DELETE' });
}

interface MailhogMessage {
  To: Array<{ Mailbox: string; Domain: string }>;
  Content: { Body: string };
}

/** Polls Mailhog briefly since delivery to the local SMTP catcher is async. */
export async function getLatestOtpCode(
  toEmail: string,
  retries = 20,
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${MAILHOG_API}/v2/messages?limit=50`);
    const data = (await res.json()) as { items: MailhogMessage[] };
    const match = data.items.find((m) =>
      m.To.some(
        (t) =>
          `${t.Mailbox}@${t.Domain}`.toLowerCase() === toEmail.toLowerCase(),
      ),
    );
    if (match) {
      // Anchor on the "Your code:" line — the multipart boundary is random
      // hex and can itself contain a run of six digits.
      const codeMatch = /code:\s*(\d{6})/i.exec(match.Content.Body);
      if (codeMatch) return codeMatch[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`No OTP email found for ${toEmail} after ${retries} retries`);
}
