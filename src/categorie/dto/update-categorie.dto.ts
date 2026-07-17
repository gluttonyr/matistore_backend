import { IsOptional, IsString } from 'class-validator';

export class UpdateCategorieDto {
  @IsOptional()
  @IsString()
  libelle?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
