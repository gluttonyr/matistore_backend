import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../utilisateur/entities/user.entity';
import { Categorie } from '../../categorie/entities/categorie.entity';

@Entity('events')
export class Evenement extends BaseEntity {
  @Column()
  titre!: string;

  @Column()
  description!: string;

  @Column({ nullable: true })
  coverImage?: string;

  @Column()
  dateDebut!: Date;

  @Column()
  dateFin!: Date;

  @Column({ nullable: true })
  lieu?: string;

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => Categorie, { nullable: false })
  @JoinColumn({ name: 'categorie_id' })
  categorie!: Categorie;
}
