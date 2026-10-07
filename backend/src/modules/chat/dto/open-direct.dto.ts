import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class OpenDirectDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}
