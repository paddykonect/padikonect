import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, Matches } from 'class-validator';

export class SetPhoneInvitesDto {
  @ApiProperty({
    type: [String],
    example: ['+2348012345678'],
    description:
      'Nigerian numbers to invite by phone (SMS send is manual for now)',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^\+234\d{10}$/, {
    each: true,
    message: 'each phone must be a valid +234 Nigerian number',
  })
  phones!: string[];
}
