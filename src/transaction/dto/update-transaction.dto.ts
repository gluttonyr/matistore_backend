import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TransactionStatus, ValidationMethod } from '../entities/transaction.entity';

export class UpdateTransactionDto {
  @IsOptional() @IsEnum(TransactionStatus) statut?: TransactionStatus;
  @IsOptional() @IsString() referencePaiement?: string;
  @IsOptional() @IsString() notificationBrute?: string;
  @IsOptional() @IsEnum(ValidationMethod) methodeValidation?: ValidationMethod;
  @IsOptional() @IsString() preuveFichier?: string;
  @IsOptional() @IsString() motifRejet?: string;
}
