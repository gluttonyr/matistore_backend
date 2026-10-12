import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_capture_devices')
@Index('uq_admin_capture_device', ['adminId', 'deviceId'], { unique: true })
export class AdminCaptureDevice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'admin_id', type: 'integer' })
  adminId!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 160 })
  deviceId!: string;

  @Column({ name: 'last_heartbeat_at', type: 'timestamp' })
  lastHeartbeatAt!: Date;

  @Column({ name: 'consecutive_healthy_signals', type: 'integer', default: 0 })
  consecutiveHealthySignals!: number;

  @Column({ name: 'failure_reason', type: 'varchar', length: 80, nullable: true })
  failureReason!: string | null;
}
