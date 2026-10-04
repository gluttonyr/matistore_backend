import { IsOptional, IsString } from 'class-validator';

export class UpdateOperateurDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  formatUssd?: string;

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
