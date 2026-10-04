import { Exclude, Expose } from 'class-transformer';
import { TransactionStatus, TransactionType, ValidationMethod } from '../entities/transaction.entity';

export class TransactionResponseDto {
  @Exclude() id?: number;
  @Expose() trackingId!: string;
  @Expose() userId!: number;
  @Expose() type!: TransactionType;
  @Expose() statut!: TransactionStatus;
  @Expose() montant!: number;
  @Expose() operateur?: string;
  @Expose() numeroTelephone?: string;
  @Expose() compteDestinataire?: string;
  @Expose() codeRetrait?: string;
  @Expose() discussionTrackingId!: string;
  @Expose() referencePaiement?: string;
  @Expose() referenceClient?: string;
  @Expose() notificationBruteClient?: string;
  @Expose() notificationBrute?: string;
  @Expose() methodeValidation?: ValidationMethod;
  @Expose() preuveFichier?: string;
  @Expose() valideParId?: number;
  @Expose() motifRejet?: string;
  @Expose() dateValidation?: Date;
  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;
}
