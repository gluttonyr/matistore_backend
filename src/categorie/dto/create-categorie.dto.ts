import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategorieDto {
  @IsNotEmpty({ message: 'Le libellé est requis' })
  @IsString()
  libelle!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
