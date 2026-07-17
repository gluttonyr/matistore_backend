import { Exclude, Expose } from 'class-transformer';
import { UserResponseDto } from 'src/utilisateur/dto/user-response.dto';
import { MessageType } from '../entities/message.entity';

export class MessageResponseDto {
  @Exclude()
  id?: number;

  @Expose()
  trackingId!: string;
  @Expose()
  type!:MessageType;
  @Expose()
  image?: string;
  @Expose()
  contenu!: string;
  @Expose()
  lu!: boolean;
  @Expose()
  dateLu?: Date;
  @Expose()
  isEdited!: boolean;
  @Expose()
  editedAt?: Date;
  @Expose()
  isDeleted!: boolean;
  @Expose()
  deletedAt?: Date;
  @Expose()
  epingle!: boolean;
  @Expose()
  dateEnvoi?: Date;
  @Expose()
  senderTrackingId?: string;
  @Expose()
  sender?:UserResponseDto;
  @Expose()
  discussionTrackingId?: string;
  @Expose()
  parentTrackingId?: string;
  @Expose()
  createdAt!: Date;
  @Expose()
  updatedAt!: Date;
}
