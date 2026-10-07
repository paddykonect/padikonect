import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportTopic } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../integrations/mailer/mailer.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';

const TOPIC_LABEL: Record<SupportTopic, string> = {
  HANGOUTS: 'Hangouts',
  REWARDS: 'Rewards',
  REPORT_PADI: 'Report a padi',
  OTHER: 'Other',
};

function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  /** Stores the message (the system of record) and forwards it to the support inbox. */
  async create(userId: string, dto: CreateSupportMessageDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true, email: true },
    });
    const row = await this.prisma.supportMessage.create({
      data: { userId, topic: dto.topic, message: dto.message.trim() },
    });

    const inbox = this.config.get<string>('mail.supportEmail');
    if (inbox) {
      const subject = `[Support] ${TOPIC_LABEL[dto.topic]} — ${user.fullName}`;
      const text = `From: ${user.fullName} <${user.email}>\nTopic: ${TOPIC_LABEL[dto.topic]}\nRef: ${row.id}\n\n${row.message}`;
      // A failed forward shouldn't lose the message — it's already stored.
      await this.mailer
        .send(
          inbox,
          subject,
          `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
          text,
        )
        .catch((err: unknown) =>
          this.logger.error(
            `Couldn't forward support message ${row.id}: ${String(err)}`,
          ),
        );
    }
    return { id: row.id, createdAt: row.createdAt };
  }
}
