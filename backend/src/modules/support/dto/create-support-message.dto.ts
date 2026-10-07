import { ApiProperty } from '@nestjs/swagger';
import { SupportTopic } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportMessageDto {
  @ApiProperty({ enum: SupportTopic })
  @IsEnum(SupportTopic)
  topic!: SupportTopic;

  @ApiProperty()
  @IsString()
  @MinLength(10, { message: 'Please tell us a little more (10+ characters).' })
  @MaxLength(2000)
  message!: string;
}
