import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOperateurDto {
  @IsNotEmpty({ message: 'Le nom est requis' })
  @IsString()
  nom!: string;

  /** Ex: "*155*2*2*{numero}*{numero}*{montant}#" — voir Operateur.formatUssd. */
  @IsNotEmpty({ message: 'Le format USSD est requis' })
  @IsString()
  formatUssd!: string;

  @IsOptional()
  @IsString()
  notification_name?: string;

  @IsOptional()
  @IsString()
  notificationPackageClient?: string;

  @IsOptional()
  @IsString()
  notificationPatternClient?: string;

  @IsOptional()
  @IsString()
  notificationPackageAdmin?: string;

  @IsOptional()
  @IsString()
  notificationPatternAdmin?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  active?: boolean;
}
