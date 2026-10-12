import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('admin_capture_state')
export class AdminCaptureState {
  @PrimaryColumn({ type: 'smallint', default: 1 })
  id!: number;

  @Column({ name: 'manual_override', type: 'boolean', default: false })
  manualOverride!: boolean;

  @Column({ name: 'outage_started_at', type: 'timestamp', nullable: true })
  outageStartedAt!: Date | null;

  @Column({ name: 'paused_expiration_ms', type: 'bigint', default: 0 })
  pausedExpirationMs!: string;

  @Column({ name: 'last_reminder_at', type: 'timestamp', nullable: true })
  lastReminderAt!: Date | null;

  @Column({ name: 'last_reported_available', type: 'boolean', default: false })
  lastReportedAvailable!: boolean;
}
