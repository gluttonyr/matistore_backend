import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { MessageReaction } from '../entities/message-reaction.entity';
import { CreateMessageReactionDto } from '../dto/create-message-reaction.dto';
import { UpdateMessageReactionDto } from '../dto/update-message-reaction.dto';
import { MessageReactionResponseDto } from '../dto/message-reaction-response.dto';

@Injectable()
export class MessageReactionMapper extends BaseMapper<MessageReaction, MessageReactionResponseDto> {
  async toEntity(dto: CreateMessageReactionDto | UpdateMessageReactionDto): Promise<Partial<MessageReaction>> {
    const reaction = plainToInstance(MessageReaction, dto, { excludeExtraneousValues: false });
    reaction.trackingId = uuidv4();
    return reaction;
  }

  toResponse(entity: MessageReaction): MessageReactionResponseDto {
    const response = plainToInstance(MessageReactionResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    response.userTrackingId = entity.user?.trackingId;
    response.messageTrackingId = entity.message?.trackingId;
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: MessageReaction[]): Promise<MessageReactionResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
