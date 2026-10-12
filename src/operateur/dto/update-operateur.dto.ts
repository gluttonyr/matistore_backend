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
  formatRetraitUssd?: string;

  @IsOptional()
  @IsString()
  notification_name?: string;

  @IsOptional()
  @IsString()
  notificationTitleAdmin?: string;

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
