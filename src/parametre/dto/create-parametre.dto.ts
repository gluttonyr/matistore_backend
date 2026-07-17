import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateParametreDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  libelle!: string;

  @IsNotEmpty()
  @IsNumber()
  valeur!: number;
}
