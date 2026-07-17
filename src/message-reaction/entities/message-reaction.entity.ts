import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../utilisateur/entities/user.entity';
import { Message } from '../../message/entities/message.entity';
import { TypeEmoji } from '../enums/type-emoji.enum';

@Entity('message_reactions')
@Unique(['message', 'user'])
export class MessageReaction extends BaseEntity {
  @Column({ type: 'enum', enum: TypeEmoji })
  typeEmoji!: TypeEmoji;

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => Message, (message) => message.reactions, {
    onDelete: 'CASCADE',
  })
  message!: Message;
}
