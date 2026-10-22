import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { User } from '../../utilisateur/entities/user.entity';

export enum SmsCaptureStatus {
  ATTRIBUE = 'ATTRIBUE',
  SANS_TRANSACTION = 'SANS_TRANSACTION',
  A_RAPPROCHER = 'A_RAPPROCHER',
  IGNORE = 'IGNORE',
}

export enum SmsAttributionOrigin {
  AUTO_MATI_PAY = 'AUTO_MATI_PAY',
  MATISTORE = 'MATISTORE',
  MANUEL = 'MANUEL',
}

@Entity('sms_captures')
export class SmsCapture {
  @PrimaryGeneratedColumn('uuid') trackingId!: string;

  @Column({ name: 'fingerprint', type: 'varchar', length: 64, unique: true })
  fingerprint!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 160 })
  deviceId!: string;

  @Column({ name: 'expediteur', type: 'varchar', length: 160 })
  expediteur!: string;

  @Column({ name: 'corps', type: 'text' })
  corps!: string;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt!: Date;

  @Column({ name: 'operateur', type: 'varchar', length: 100, nullable: true })
  operateur!: string | null;

  @Column({ name: 'montant', type: 'integer', nullable: true })
  montant!: number | null;

  @Column({ name: 'telephone', type: 'varchar', length: 40, nullable: true })
  telephone!: string | null;

  @Column({ name: 'reference', type: 'varchar', length: 160, nullable: true })
  reference!: string | null;

  @Column({ name: 'statut', type: 'enum', enum: SmsCaptureStatus, enumName: 'sms_capture_status' })
  statut!: SmsCaptureStatus;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transaction_id', referencedColumnName: 'trackingId' })
  transaction!: Transaction | null;

  @Column({
    name: 'origine_attribution',
    type: 'enum',
    enum: SmsAttributionOrigin,
    enumName: 'sms_attribution_origin',
    nullable: true,
  })
  origineAttribution!: SmsAttributionOrigin | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'attribue_par_id' })
  attribuePar!: User | null;

  @Column({ name: 'motif', type: 'text', nullable: true })
  motif!: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
