import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AssignSmsDto {
  @IsUUID() transactionId!: string;
  @IsOptional() @IsBoolean() confirmPhoneMismatch?: boolean;
}
