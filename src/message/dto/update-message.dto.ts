import { IsOptional, IsString, IsBoolean, IsDate } from 'class-validator';
import { CreateMessageReactionDto } from 'src/message-reaction/dto/create-message-reaction.dto';
import { UpdateMessageReactionDto } from 'src/message-reaction/dto/update-message-reaction.dto';

export class UpdateMessageDto {
  @IsOptional()
  @IsString()
  contenu?: string;

  @IsOptional()
  @IsBoolean()
  lu?: boolean;

  @IsOptional()
  @IsDate()
  dateLu?: Date;
  reaction?: CreateMessageReactionDto | UpdateMessageReactionDto;
  parentId?: string;
}
