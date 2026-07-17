import { IsOptional, IsString } from 'class-validator';

export class UpdateStickerDto {
  @IsOptional()
  @IsString()
  libelle?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  image?: string;
}
