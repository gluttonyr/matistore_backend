import { IsNotEmpty, IsString, IsDate, IsOptional } from 'class-validator';

export class CreateEvenementDto {
  @IsNotEmpty()
  @IsString()
  titre!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsNotEmpty()
  @IsDate()
  dateDebut!: Date;

  @IsNotEmpty()
  @IsDate()
  dateFin!: Date;

  @IsOptional()
  @IsString()
  lieu?: string;

  @IsNotEmpty({ message: 'La catégorie est requise' })
  @IsString()
  categorieTrackingId!: string;
}
