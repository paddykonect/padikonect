import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsEmail, IsString, Matches, MinLength } from 'class-validator';

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

  @ApiProperty({ description: 'Must confirm 18+' })
  @Equals(true, { message: 'you must confirm you are 18 or older' })
  ageConfirmed!: boolean;

  @ApiProperty({ description: 'Must accept terms' })
  @Equals(true, { message: 'you must accept the terms' })
  termsAccepted!: boolean;
}
