import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity('parametres')
@Unique(['code'])
export class Parametre extends BaseEntity {
  @Column()
  code!: string;

  @Column()
  libelle!: string;

  @Column('float')
  valeur!: number;
}
