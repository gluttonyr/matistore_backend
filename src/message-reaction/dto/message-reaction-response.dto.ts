import { Exclude, Expose } from 'class-transformer';
import { TypeEmoji } from '../enums/type-emoji.enum';

export class MessageReactionResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;

  typeEmoji!: TypeEmoji;
  userTrackingId?: string;
  messageTrackingId?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
