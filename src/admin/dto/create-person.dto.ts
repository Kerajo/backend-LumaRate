import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreatePersonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
