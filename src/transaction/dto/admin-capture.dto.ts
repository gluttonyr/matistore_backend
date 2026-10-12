import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AdminCaptureDto {
  @IsString()
  @IsNotEmpty()
  operateur!: string;

  @IsInt()
  @Min(1)
  montant!: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  notificationPostedAt?: number;

  @IsString()
  @IsNotEmpty()
  numeroTelephoneClient!: string;

  @IsString()
  @IsNotEmpty()
  notificationBrute!: string;

  @IsOptional()
  @IsString()
  packageNotification?: string;

  @IsOptional()
  @IsString()
  titreNotification?: string;
}
