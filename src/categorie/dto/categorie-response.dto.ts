import { Exclude, Expose } from 'class-transformer';

export class CategorieResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  @Expose()
  libelle!: string;

  @Expose()
  description?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
