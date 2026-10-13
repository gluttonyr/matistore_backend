import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectTransactionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}
