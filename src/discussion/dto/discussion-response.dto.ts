import { Exclude, Expose } from 'class-transformer';
import { DiscussionStatus, DiscussionType } from '../entities/discussion.entity';

export class DiscussionResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;
  @Expose()
  titre!: string;
  @Expose()
  type!: DiscussionType;
  @Expose()
  statut!: DiscussionStatus;
  @Expose()
  image?: string;

  @Expose()
  active!: boolean;

  @Expose()
  lastMessageAt!: Date;

  @Expose()
  username!:string;

  @Expose()
  userProfile?: {
    trackingId: string;
    nom: string;
    prenom: string;
    username: string;
    email: string;
    telephone?: string | null;
    active: boolean;
    createdAt: Date;
  };

  @Expose()
  lastMessageContent?: string;

  @Expose()
  unreadCount?: number;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
