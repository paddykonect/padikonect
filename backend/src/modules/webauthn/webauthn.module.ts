import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WebauthnController } from './webauthn.controller';
import { WebauthnService } from './webauthn.service';

@Module({
  imports: [AuthModule],
  controllers: [WebauthnController],
  providers: [WebauthnService],
})
export class WebauthnModule {}
