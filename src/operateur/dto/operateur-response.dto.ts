import { Exclude, Expose } from 'class-transformer';

export class OperateurResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  @Expose()
  nom!: string;

  @Expose()
  formatUssd!: string;

  @Expose()
  notification_name?: string;

  @Expose()
  notificationPackageClient?: string;

  @Expose()
  notificationPatternClient?: string;

  @Expose()
  notificationPackageAdmin?: string;

  @Expose()
  notificationPatternAdmin?: string;

  @Expose()
  imageUrl?: string;

  @Expose()
  active!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
