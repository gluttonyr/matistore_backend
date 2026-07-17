import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { DiscussionParticipant } from '../entities/discussion-participant.entity';
import { CreateDiscussionParticipantDto } from '../dto/create-discussion-participant.dto';
import { UpdateDiscussionParticipantDto } from '../dto/update-discussion-participant.dto';
import { DiscussionParticipantResponseDto } from '../dto/discussion-participant-response.dto';

@Injectable()
export class DiscussionParticipantMapper extends BaseMapper<DiscussionParticipant, DiscussionParticipantResponseDto> {
  async toEntity(dto: CreateDiscussionParticipantDto | UpdateDiscussionParticipantDto): Promise<Partial<DiscussionParticipant>> {
    const participant = plainToInstance(DiscussionParticipant, dto, { excludeExtraneousValues: false });
    participant.trackingId = uuidv4();
    if (!participant.joinedAt) {
      participant.joinedAt = new Date();
    }
    return participant;
  }

  toResponse(entity: DiscussionParticipant): DiscussionParticipantResponseDto {
    const response = plainToInstance(DiscussionParticipantResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    response.discussionTrackingId = entity.discussion?.trackingId;
    response.userTrackingId = entity.user?.trackingId;
    response.username = entity.user?.username;
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: DiscussionParticipant[]): Promise<DiscussionParticipantResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
