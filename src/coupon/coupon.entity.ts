import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CouponStatus {
  EN_COURS = 'EN_COURS',
  GAGNE = 'GAGNE',
  PERDU = 'PERDU',
}

export type CouponCode = { bookmaker: string; code: string };

/** "Coupon du jour": a screenshot of a bet slip and its code for each bookmaker. */
@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'int', unique: true }) number!: number;
  /** Full URL of the screenshot (uploads folder "coupons"). */
  @Column({ name: 'image_url', type: 'text' }) imageUrl!: string;
  @Column({ type: 'jsonb' }) codes!: CouponCode[];
  @Column({ type: 'varchar', length: 12, nullable: true }) odds?: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) note?: string | null;
  @Column({ type: 'varchar', length: 10, default: CouponStatus.EN_COURS }) status!: CouponStatus;
  @Column({ name: 'created_by_id', type: 'int', nullable: true }) createdById?: number | null;
  @Index('idx_coupons_created_at') @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
