import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SmsCaptureStatus } from '../entities/sms-capture.entity';

export class SmsListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsEnum(SmsCaptureStatus) statut?: SmsCaptureStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() transactionId?: string;
}

export class SmsCandidatesQueryDto {
  @IsString() transactionId!: string;
}
