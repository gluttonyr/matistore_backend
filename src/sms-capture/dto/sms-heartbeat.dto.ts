import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SmsDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  deviceId!: string;
}

export class SmsHeartbeatDto {
  @IsBoolean()
  ready!: boolean;

  @IsOptional()
  @IsIn(['notification_access_required', 'capture_not_configured', 'session_expired', 'network_unavailable'])
  reason?: string;
}
