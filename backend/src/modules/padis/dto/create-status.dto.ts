import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

// At least one of text/imageUrl is required — enforced in the service so the
// error message can say so plainly.
export class CreateStatusDto {
  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  text?: string;

  @ApiPropertyOptional({
    description:
      'Cloudinary URL from the signed upload (GET /statuses/upload-signature)',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
}
