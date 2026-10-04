import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsEnum(TransactionType) type!: TransactionType;
  @IsOptional() @IsInt() @Min(1) montant?: number;
  @IsOptional() @IsString() operateur?: string;
  @IsOptional() @IsString() numeroTelephone?: string;
  @IsOptional() @IsString() compteDestinataire?: string;
  @IsOptional() @IsString() codeRetrait?: string;
  @IsOptional() @IsString() referenceClient?: string;
  @IsOptional() @IsString() notificationBruteClient?: string;
}
