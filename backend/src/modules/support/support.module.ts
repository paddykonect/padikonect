import { Module } from '@nestjs/common';
import { MailerModule } from '../../integrations/mailer/mailer.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [MailerModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
