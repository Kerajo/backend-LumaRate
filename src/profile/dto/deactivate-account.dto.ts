import { IsOptional, IsString } from 'class-validator';

export class DeactivateAccountDto {
  @IsOptional()
  @IsString()
  password?: string;
}
