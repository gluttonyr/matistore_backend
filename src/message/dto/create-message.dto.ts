import { IsNotEmpty, IsString, IsOptional, IsDate, IsBoolean } from 'class-validator';
import { CreateMessageReactionDto } from 'src/message-reaction/dto/create-message-reaction.dto';
import { UpdateMessageReactionDto } from 'src/message-reaction/dto/update-message-reaction.dto';
import { MessageType } from '../entities/message.entity';

export class CreateMessageDto {
  @IsNotEmpty()
  discussionId!: string;

  @IsNotEmpty()
  type!:MessageType;

  @IsNotEmpty()
  @IsString()
  contenu!: string;

  @IsOptional()
  @IsDate()
  dateEnvoi?: Date;

  @IsOptional()
  reaction?: CreateMessageReactionDto | UpdateMessageReactionDto;
  @IsOptional()
  parentId?: string;
}
