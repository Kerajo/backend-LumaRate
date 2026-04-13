import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRecensionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(200)
  text!: string;
}
