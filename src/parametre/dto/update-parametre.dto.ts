import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateParametreDto {
  @IsOptional()
  @IsString()
  libelle?: string;

  @IsOptional()
  @IsNumber()
  valeur?: number;
}
