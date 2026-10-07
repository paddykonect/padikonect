import { ApiProperty } from '@nestjs/swagger';
import { Equals } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'The "I understand this is permanent" checkbox' })
  @Equals(true, { message: 'please confirm you understand this is permanent' })
  confirm!: boolean;
}
