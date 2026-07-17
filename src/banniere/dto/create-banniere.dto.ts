import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';

export class CreateBanniereDto {
  @IsNotEmpty()
  @IsString()
  titre!: string;

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
