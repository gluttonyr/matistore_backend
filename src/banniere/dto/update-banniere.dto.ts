import { IsOptional, IsString, IsInt } from 'class-validator';

export class UpdateBanniereDto {
  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  @IsString()
  sousTitre?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  texteCta?: string;

  @IsOptional()
  @IsString()
  lien?: string;

  @IsOptional()
  @IsInt()
  ordre?: number;
}
