import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from =
      config.get<string>('mail.from') ??
      'Paddykonect <no-reply@paddykonect.com>';
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('mail.host'),
      port: config.get<number>('mail.port'),
      secure: config.get<boolean>('mail.secure'),
      auth: config.get<string>('mail.user')
        ? {
            user: config.get<string>('mail.user'),
            pass: config.get<string>('mail.password'),
          }
        : undefined,
    });
  }

  // Never called with OTP codes/tokens in the log line — callers pass rendered HTML only.
  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, html });
    this.logger.log(`Sent "${subject}" email to ${to}`);
  }

  async sendOtp(
    to: string,
    code: string,
    purpose: 'signup' | 'password-reset',
  ): Promise<void> {
    const subject =
      purpose === 'signup'
        ? 'Verify your Paddykonect account'
        : 'Reset your Paddykonect password';
    const html = `
      <p>Your Paddykonect verification code is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    `;
    await this.send(to, subject, html);
  }
}
