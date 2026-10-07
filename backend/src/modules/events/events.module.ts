import { Module } from '@nestjs/common';
import { GeoModule } from '../../database/geo/geo.module';
import { CloudinaryModule } from '../../integrations/cloudinary/cloudinary.module';
import { GoogleMapsModule } from '../../integrations/google-maps/google-maps.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventHostGuard } from './guards/event-host.guard';
import { HostingService } from './hosting.service';

@Module({
  imports: [GeoModule, CloudinaryModule, GoogleMapsModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService, HostingService, EventHostGuard],
  exports: [EventHostGuard],
})
export class EventsModule {}
