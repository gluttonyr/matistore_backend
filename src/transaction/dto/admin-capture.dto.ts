import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AdminCaptureDto {
  @IsString()
  @IsNotEmpty()
  operateur!: string;

  @IsInt()
  @Min(1)
  montant!: number;

  @IsString()
  @IsNotEmpty()
  referencePaiement!: string;

  @IsOptional()
  @IsString()
  numeroTelephoneClient?: string;

  @IsString()
  @IsNotEmpty()
  notificationBrute!: string;

  @IsOptional()
  @IsString()
  packageNotification?: string;
}
