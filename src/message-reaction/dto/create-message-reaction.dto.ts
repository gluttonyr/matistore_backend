import { IsNotEmpty, IsEnum } from 'class-validator';
import { TypeEmoji } from '../enums/type-emoji.enum';

export class CreateMessageReactionDto {
  @IsNotEmpty()
  messageId!: string;

  @IsNotEmpty()
  userId!: string;

  @IsNotEmpty()
  @IsEnum(TypeEmoji, { message: 'typeEmoji doit être l\'un des emojis autorisés' })
  typeEmoji!: TypeEmoji;
}
