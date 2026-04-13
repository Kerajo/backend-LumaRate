import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Length(2, 2)
  code!: string;
}
