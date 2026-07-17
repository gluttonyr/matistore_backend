import { BaseEntity } from 'src/common/base.entity';
import { DiscussionParticipant } from 'src/discussion-participant/entities/discussion-participant.entity';
import { Message } from 'src/message/entities/message.entity';
import {Column, Entity, OneToMany } from 'typeorm';

export enum DiscussionType {
  DEPOT_RETRAIT = 'depot_retrait',
  SUPPORT = 'support',
  FORUM = 'forum'
}

 export enum DiscussionStatus {
   DEPOT = 'depot',
   RETRAIT = 'retrait',
    AUTRE = 'autre',
 }

@Entity('discussions')
export class Discussion extends BaseEntity {
  @Column()
  titre!: string;

   @Column({
        type: 'enum',
        enum: DiscussionType,
        // default: DiscussionType.DEPOT_RETRAIT,
    })
  type!: DiscussionType;

   @Column({
        type: 'enum',
        enum: DiscussionStatus,
        default: DiscussionStatus.AUTRE,
    })
  statut!: DiscussionStatus;

  @Column({ default: true })
  active!: boolean;

  @Column({ nullable: true })
  image?: string;

  @OneToMany(() => DiscussionParticipant, (participant) => participant.discussion)
  participants!: DiscussionParticipant[];

  @OneToMany(() => Message, (message) => message.discussion)
  messages!: Message[];

  @Column({ name: 'last_message_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastMessageAt!: Date;

  @Column({ nullable: true })
  lastMessageContent!:string;

}
