import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RsvpMeController } from './rsvp-me.controller';
import { RsvpController } from './rsvp.controller';
import { RsvpService } from './rsvp.service';

@Module({
  imports: [EventsModule, NotificationsModule],
  controllers: [RsvpController, RsvpMeController],
  providers: [RsvpService],
})
export class RsvpModule {}
