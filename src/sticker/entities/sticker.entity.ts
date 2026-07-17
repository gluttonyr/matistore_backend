import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity('stickers')
@Unique(['code'])
export class Sticker extends BaseEntity {
  @Column()
  libelle!: string;

  @Column()
  code!: string;

  @Column({ nullable: true })
  image?: string;
}
