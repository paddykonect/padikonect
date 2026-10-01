import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class UpdateAvatarDto {
  @ApiProperty({
    description:
      'The secure_url returned by Cloudinary after the direct client upload',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  photoUrl!: string;
}
