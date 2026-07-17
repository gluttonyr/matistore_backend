import { Exclude, Expose } from 'class-transformer';

export class EvenementResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  @Expose()
  titre!: string;

  @Expose()
  description!: string;

  @Expose()
  coverImage?: string;

  @Expose()
  dateDebut!: Date;

  @Expose()
  dateFin!: Date;

  @Expose()
  lieu?: string;

  @Expose()
  userId?: string;

  @Expose()
  categorieId?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
