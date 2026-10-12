import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TransactionStatus } from '../entities/transaction.entity';

export class ResolveClaimDto {
  @IsIn([TransactionStatus.VALIDEE, TransactionStatus.REJETEE])
  decision!: TransactionStatus.VALIDEE | TransactionStatus.REJETEE;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}
