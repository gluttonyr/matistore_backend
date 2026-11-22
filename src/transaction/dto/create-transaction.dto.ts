import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsEnum(TransactionType) type!: TransactionType;
  @IsOptional() @IsInt() @Min(1) montant?: number;
  @IsOptional() @IsString() operateur?: string;
  /** Bookmaker code (1XBET, MELBET…); absent from apps installed before the choice → 1XBET. */
  @IsOptional() @IsString() @MaxLength(20) bookmaker?: string;
  @IsOptional() @IsString() numeroTelephone?: string;
  @IsOptional() @IsString() compteDestinataire?: string;
  @IsOptional() @IsString() codeRetrait?: string;
}
