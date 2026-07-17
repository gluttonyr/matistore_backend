import { Exclude, Expose } from 'class-transformer';

export class DiscussionParticipantResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  joinedAt!: Date;
  isAdmin!: boolean;
  discussionTrackingId?: string;
  @Expose()
  userTrackingId?: string;
  @Expose()
  username?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
