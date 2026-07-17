import { Exclude, Expose } from 'class-transformer';

export class BanniereResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  @Expose()
  titre!: string;

  @Expose()
  sousTitre?: string;

  @Expose()
  image?: string;

  @Expose()
  texteCta?: string;

  @Expose()
  lien?: string;

  @Expose()
  ordre!: number;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
