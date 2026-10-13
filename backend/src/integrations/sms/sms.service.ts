import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AtRecipient {
  number: string;
  status: string;
  statusCode?: number;
}
interface AtResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AtRecipient[];
  };
}

/**
 * Africa's Talking SMS. Best-effort: every method logs and swallows failures
 * so a texting hiccup never breaks the request that triggered it. No-ops (with
 * a warning) when AFRICASTALKING_API_KEY is unset, so local/dev still works.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey?: string;
  private readonly username: string;
  private readonly senderId?: string;
  private readonly endpoint: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('sms.apiKey');
    this.username = config.get<string>('sms.username') ?? 'sandbox';
    this.senderId = config.get<string>('sms.senderId');
    // "sandbox" is Africa's Talking's test username, with its own host.
    this.endpoint =
      this.username === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /** Sends one message to many numbers (+234… E.164). Returns how many were accepted. */
  async send(to: string[], message: string): Promise<number> {
    const numbers = to.filter(Boolean);
    if (numbers.length === 0) return 0;
    if (!this.enabled) {
      this.logger.warn(
        `SMS not configured (AFRICASTALKING_API_KEY unset) — skipping ${numbers.length} invite text(s).`,
      );
      return 0;
    }

    const body = new URLSearchParams({
      username: this.username,
      to: numbers.join(','),
      message,
    });
    if (this.senderId) body.set('from', this.senderId);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          apiKey: this.apiKey as string,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
      const json = (await res.json().catch(() => ({}))) as AtResponse;
      if (!res.ok) {
        this.logger.error(
          `Africa's Talking SMS failed (HTTP ${res.status}): ${JSON.stringify(json)}`,
        );
        return 0;
      }
      const recipients = json.SMSMessageData?.Recipients ?? [];
      const sent = recipients.filter((r) => r.status === 'Success').length;
      this.logger.log(`SMS: ${sent}/${numbers.length} recipient(s) accepted.`);
      return sent;
    } catch (err) {
      this.logger.error(
        `Africa's Talking SMS error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }
}
