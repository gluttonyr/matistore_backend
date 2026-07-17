import { Exclude, Expose } from 'class-transformer';

export class ParametreResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  code!: string;
  libelle!: string;
  valeur!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
