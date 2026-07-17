import { Exclude, Expose } from 'class-transformer';

export class StickerResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  @Expose()
  libelle!: string;

  @Expose()
  code!: string;

  @Expose()
  image?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
