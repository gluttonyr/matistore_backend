import { Exclude, Expose } from 'class-transformer';

export class PushDeviceResponseDto {
  @Exclude()
  id?: string;

  @Expose()
  userId!: string;

  @Expose()
  token!: string;

  @Expose()
  platform!: 'android' | 'ios';

  @Expose()
  deviceId?: string;

  @Expose()
  active!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
