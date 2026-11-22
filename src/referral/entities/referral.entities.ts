import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../utilisateur/entities/user.entity';

export type ReferralPrize = {
  rank: number;
  type: 'MONEY' | 'LOT';
  /** MONEY: amount in FCFA. */
  amount?: number | null;
  /** LOT: name of the prize. */
  label?: string | null;
  /** LOT: picture (uploads folder "referral"). */
  imageUrl?: string | null;
};

export enum ReferralRoundStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

/** One row per user who has a code, a parrain, or has seen the "Avez-vous un code ?" prompt. */
@Entity('referral_profiles')
export class ReferralProfile {
  @PrimaryColumn({ name: 'user_id', type: 'int' }) userId!: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user!: User;

  /** Given once, after a first validated deposit; never changes. */
  @Column({ type: 'varchar', length: 16, nullable: true, unique: true }) code?: string | null;
  @Column({ name: 'code_created_at', type: 'timestamp', nullable: true }) codeCreatedAt?: Date | null;

  @Index('idx_referral_profiles_parrain') @Column({ name: 'parrain_id', type: 'int', nullable: true }) parrainId?: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'parrain_id' }) parrain?: User | null;
  /** Only deposits made from this moment count for the current parrain. */
  @Column({ name: 'parrain_since', type: 'timestamp', nullable: true }) parrainSince?: Date | null;

  @Column({ name: 'prompt_seen', type: 'boolean', default: false }) promptSeen!: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

/** Settings for the NEXT rounds (a running round keeps the copy it was created with). Single row, id 1. */
@Entity('referral_settings')
export class ReferralSettings {
  @PrimaryColumn({ type: 'int' }) id!: number;
  @Column({ type: 'boolean', default: false }) active!: boolean;
  @Column({ name: 'duration_days', type: 'int', default: 7 }) durationDays!: number;
  @Column({ name: 'winners_count', type: 'int', default: 5 }) winnersCount!: number;
  @Column({ name: 'deposits_required', type: 'int', default: 3 }) depositsRequired!: number;
  @Column({ name: 'min_amount', type: 'int', default: 500 }) minAmount!: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) prizes!: ReferralPrize[];
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('referral_rounds')
export class ReferralRound {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', unique: true }) number!: number;
  @Column({ type: 'varchar', length: 12, default: ReferralRoundStatus.ACTIVE }) status!: ReferralRoundStatus;
  @Column({ name: 'start_at', type: 'timestamp' }) startAt!: Date;
  @Column({ name: 'end_at', type: 'timestamp' }) endAt!: Date;
  @Column({ name: 'duration_days', type: 'int' }) durationDays!: number;
  @Column({ name: 'winners_count', type: 'int' }) winnersCount!: number;
  @Column({ name: 'deposits_required', type: 'int' }) depositsRequired!: number;
  @Column({ name: 'min_amount', type: 'int' }) minAmount!: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) prizes!: ReferralPrize[];
  @Column({ name: 'finished_at', type: 'timestamp', nullable: true }) finishedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}

@Entity('referral_winners')
@Unique('uq_referral_winners_round_rank', ['round', 'rank'])
export class ReferralWinner {
  @PrimaryGeneratedColumn() id!: number;
  @ManyToOne(() => ReferralRound, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'round_id' }) round!: ReferralRound;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ type: 'int' }) rank!: number;
  @Column({ name: 'validated_count', type: 'int' }) validatedCount!: number;
  @Column({ type: 'jsonb', nullable: true }) prize?: ReferralPrize | null;
  @Column({ type: 'boolean', default: false }) rewarded!: boolean;
  @Column({ name: 'rewarded_at', type: 'timestamp', nullable: true }) rewardedAt?: Date | null;
  @Column({ name: 'rewarded_by_id', type: 'int', nullable: true }) rewardedById?: number | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
