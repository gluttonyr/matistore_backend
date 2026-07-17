import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { Message } from '../entities/message.entity';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { MessageResponseDto } from '../dto/message-response.dto';
import { UserResponseDto } from 'src/utilisateur/dto/user-response.dto';

@Injectable()
export class MessageMapper extends BaseMapper<Message, MessageResponseDto> {
  async toEntity(dto: CreateMessageDto | UpdateMessageDto): Promise<Partial<Message>> {
    const message = plainToInstance(Message, dto, { excludeExtraneousValues: false });
    message.trackingId = uuidv4();
    if (!message.dateEnvoi) {
      message.dateEnvoi = new Date();
    }
    return message;
  }

  toResponse(entity: Message): MessageResponseDto {
    const response = plainToInstance(MessageResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    response.senderTrackingId = entity.sender?.trackingId;
    response.parentTrackingId = entity.parent?.trackingId;
    response.sender = entity.sender ? plainToInstance(UserResponseDto, entity.sender, { excludeExtraneousValues: true }) : undefined;
    response.discussionTrackingId = entity.discussion?.trackingId;
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: Message[]): Promise<MessageResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
