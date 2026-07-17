import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateStickerDto {
  @IsNotEmpty()
  @IsString()
  libelle!: string;

  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  image?: string;
}
