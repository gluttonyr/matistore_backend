import { IsOptional, IsString, IsDate } from 'class-validator';

export class UpdateEvenementDto {
  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsDate()
  dateDebut?: Date;

  @IsOptional()
  @IsDate()
  dateFin?: Date;

  @IsOptional()
  @IsString()
  lieu?: string;

  @IsOptional()
  @IsString()
  categorieTrackingId?: string;
}
