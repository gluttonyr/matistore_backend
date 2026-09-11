import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum PushDevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

export class CreatePushDeviceDto {
  @IsNotEmpty()
  @IsUUID()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  token!: string;

  @IsNotEmpty()
  @IsEnum(PushDevicePlatform)
  platform!: PushDevicePlatform;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
