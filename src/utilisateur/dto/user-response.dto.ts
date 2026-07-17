import { Exclude, Expose } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';

export class UserResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;
  @Expose()
  nom!: string;
  @Expose()
  prenom!: string;
  @Expose()
  username!: string;
  @Expose()
  email!: string;
  @Expose()
  telephone!: string;
  @Expose()
  role!: UserRole;
  @Expose()
  active!: boolean;
  googleId?: string;
  provider?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

