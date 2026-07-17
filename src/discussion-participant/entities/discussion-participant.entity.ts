import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../utilisateur/entities/user.entity';
import { Discussion } from '../../discussion/entities/discussion.entity';

@Entity('discussion_participants')
export class DiscussionParticipant extends BaseEntity {
  @Column()
  joinedAt!: Date;

  @Column({ default: false })
  isAdmin!: boolean;

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => Discussion, (discussion) => discussion.participants, {
    onDelete: 'CASCADE',
  })
  discussion!: Discussion;
}
