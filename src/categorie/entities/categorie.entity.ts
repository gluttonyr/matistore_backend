import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity('categories')
export class Categorie extends BaseEntity {
  @Column()
  libelle!: string;

  @Column({ nullable: true })
  description?: string;
}
