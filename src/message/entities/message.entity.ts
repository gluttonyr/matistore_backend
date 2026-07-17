import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../utilisateur/entities/user.entity';
import { Discussion } from '../../discussion/entities/discussion.entity';
import { MessageReaction } from '../../message-reaction/entities/message-reaction.entity';

 export enum MessageType {
   TEXT = 'text',
   IMAGE = 'image',
    AUDIO = 'audio',
    STICKER = 'sticker',
 }
@Entity('messages')
export class Message extends BaseEntity {

  
  @Column()
  contenu!: string;

  @Column({
        type: 'enum',
        enum: MessageType,
        default: MessageType.TEXT,
    })
  type!: MessageType;

  @Column({ default: false })
  lu!: boolean;

  @Column({ nullable: true })
  dateLu?: Date;

  @Column({ default: false })
  isEdited!: boolean;

  @Column({ nullable: true })
  editedAt?: Date;

  @Column({ default: false })
  isDeleted!: boolean;

  @Column({ nullable: true })
  deletedAt?: Date;

  @Column({ default: false })
  epingle!: boolean;

  @Column({ nullable: true })
  dateEnvoi?: Date;

  @ManyToOne(() => User)
  sender!: User;

  @ManyToOne(() => Discussion, (discussion) => discussion.messages, {
    onDelete: 'CASCADE',
  })
  discussion!: Discussion;

  @OneToMany(() => MessageReaction, (reaction) => reaction.message, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  reactions!: MessageReaction[];
  @ManyToOne(() => Message, (message) => message.replies, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  parent?: Message;

  @Column({ nullable: true })
  image?: string;

  @OneToMany(() => Message, (message) => message.parent)
  replies!: Message[];
}
