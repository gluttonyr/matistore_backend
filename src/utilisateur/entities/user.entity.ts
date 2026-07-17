import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { UserRole } from '../enums/user-role.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column()
  nom!: string;

  @Column()
  prenom!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ nullable: true })
  telephone?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ default: true })
  active!: boolean;

  @Column({ nullable: true })
  googleId?: string;

  @Column({ nullable: true })
  provider?: string;

  @Column({ nullable: true })
  expoPushToken?: string;
}
