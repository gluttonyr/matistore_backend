import { IsBoolean } from 'class-validator';

export class AdminCaptureOverrideDto {
  @IsBoolean()
  enabled!: boolean;
}
