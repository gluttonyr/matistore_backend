import { IsOptional, IsString } from 'class-validator';

export class UpdateOperateurDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  formatUssd?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  active?: boolean;
}
