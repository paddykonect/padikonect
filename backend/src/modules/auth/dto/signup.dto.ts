import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsISO8601,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: '+2348012345678' })
  @Matches(/^\+234\d{10}$/, {
    message: 'phone must be a valid +234 Nigerian number',
  })
  phone!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;

  @ApiProperty({
    example: '1998-04-21',
    description: 'YYYY-MM-DD, must be 18+',
  })
  @IsISO8601({ strict: true }, { message: 'dateOfBirth must be a valid date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth!: string;

  @ApiProperty({ description: 'Must confirm 18+' })
  @Equals(true, { message: 'you must confirm you are 18 or older' })
  ageConfirmed!: boolean;

  @ApiProperty({ description: 'Must accept terms' })
  @Equals(true, { message: 'you must accept the terms' })
  termsAccepted!: boolean;
}
