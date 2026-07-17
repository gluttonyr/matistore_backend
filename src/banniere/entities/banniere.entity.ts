import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity('bannieres')
export class Banniere extends BaseEntity {
  @Column()
  titre!: string;

  @Column({ nullable: true })
  sousTitre?: string;

  @Column({ nullable: true })
  image?: string;

  @Column({ nullable: true })
  texteCta?: string;

  @Column({ nullable: true })
  lien?: string;

  @Column({ default: 0 })
  ordre!: number;
}
