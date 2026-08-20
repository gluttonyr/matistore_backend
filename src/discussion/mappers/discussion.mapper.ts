import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { Discussion } from '../entities/discussion.entity';
import { CreateDiscussionDto } from '../dto/create-discussion.dto';
import { UpdateDiscussionDto } from '../dto/update-discussion.dto';
import { DiscussionResponseDto } from '../dto/discussion-response.dto';
import { DiscussionService } from '../discussion.service';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';

@Injectable()
export class DiscussionMapper extends BaseMapper<Discussion, DiscussionResponseDto> {

  constructor(
    private readonly discussionService: DiscussionService,
  ) {
    super();
  }
  
  async toEntity(dto: CreateDiscussionDto | UpdateDiscussionDto): Promise<Partial<Discussion>> {
    const discussion = plainToInstance(Discussion, dto, { excludeExtraneousValues: false });
    discussion.trackingId = uuidv4();
    return discussion;
  }

  // discussion.mapper.ts
toResponse(entity: Discussion): DiscussionResponseDto {
  const response = plainToInstance(DiscussionResponseDto, entity, {
    excludeExtraneousValues: true,
  });
  response.lastMessageContent = entity.lastMessageContent;
  response.username = entity.participants?.find(p => !p.isAdmin)?.user?.username ?? "";

  // messages non lus envoyés par un non-admin, dans les messages déjà chargés (findAll fait leftJoinAndSelect('discussion.messages', ...))
  response.unreadCount = entity.messages?.filter(
    (m) => !m.lu && m.sender?.role !== UserRole.ADMIN
  ).length ?? 0;

  delete (response as any).id;
  return response;
}

  async toResponseList(entities: Discussion[]): Promise<DiscussionResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
