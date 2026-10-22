import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sms_capture_device_tokens')
export class SmsCaptureDeviceToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'admin_id', type: 'integer' })
  adminId!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 160 })
  deviceId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;
}
