import { IsOptional, IsEnum } from 'class-validator';
import { TypeEmoji } from '../enums/type-emoji.enum';

export class UpdateMessageReactionDto {
  @IsOptional()
  @IsEnum(TypeEmoji)
  typeEmoji?: TypeEmoji;
}
