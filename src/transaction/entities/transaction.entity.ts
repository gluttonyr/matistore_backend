import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../utilisateur/entities/user.entity';

export enum TransactionType { DEPOT = 'DEPOT', RETRAIT = 'RETRAIT' }
export enum TransactionStatus {
  EN_ATTENTE_AUTO = 'EN_ATTENTE_AUTO',
  EN_VERIFICATION = 'EN_VERIFICATION',
  EN_ATTENTE_PREUVE = 'EN_ATTENTE_PREUVE',
  EN_ATTENTE_ADMIN = 'EN_ATTENTE_ADMIN',
  VALIDEE = 'VALIDEE',
  REJETEE = 'REJETEE',
  ANNULEE = 'ANNULEE',
}
export enum ValidationMethod { AUTO_NOTIFICATION = 'AUTO_NOTIFICATION', ADMIN_MANUEL = 'ADMIN_MANUEL' }

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid') trackingId!: string;
  @ManyToOne(() => User, { nullable: false }) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ type: 'enum', enum: TransactionType }) type!: TransactionType;
  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.EN_ATTENTE_AUTO }) statut!: TransactionStatus;
  @Column({ type: 'int' }) montant!: number;
  @Column({ type: 'varchar', length: 100, nullable: true }) operateur?: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) numeroTelephone?: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) compteDestinataire?: string;
  @Column({ name: 'code_retrait', type: 'varchar', length: 255, nullable: true }) codeRetrait?: string;
  @Column({ name: 'discussion_tracking_id', type: 'varchar', length: 100 }) discussionTrackingId!: string;
  // Référence déclarée par le client : indice non fiable, jamais utilisée seule pour valider.
  @Column({ name: 'reference_client', type: 'varchar', length: 150, nullable: true }) referenceClient?: string;
  @Column({ name: 'notification_brute_client', type: 'text', nullable: true }) notificationBruteClient?: string;
  // Référence et notification confirmées par une capture administrateur.
  @Column({ type: 'varchar', length: 150, nullable: true, unique: true }) referencePaiement?: string;
  @Column({ type: 'text', nullable: true }) notificationBrute?: string;
  @Column({ type: 'enum', enum: ValidationMethod, nullable: true }) methodeValidation?: ValidationMethod;
  @Column({ type: 'varchar', length: 255, nullable: true }) preuveFichier?: string;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'validated_by_id' }) validePar?: User;
  @Column({ type: 'text', nullable: true }) motifRejet?: string;
  @Column({ type: 'timestamp', nullable: true }) dateValidation?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
