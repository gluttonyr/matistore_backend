import { Injectable, BadRequestException } from '@nestjs/common';
import { DiscussionParticipantRepository } from './discussion-participant.repository';
import { DiscussionParticipant } from './entities/discussion-participant.entity';

@Injectable()
export class DiscussionParticipantService {
  constructor(private readonly participantRepository: DiscussionParticipantRepository) {}

  addParticipant(participant: Partial<DiscussionParticipant>) {
    return this.participantRepository.save(this.participantRepository.create(participant));
  }

  removeParticipant(id: string) {
    return this.participantRepository.delete(id);
  }

  findByDiscussion(discussionId: string) {
    return this.participantRepository.createQueryBuilder('participant')
      .leftJoinAndSelect('participant.user', 'user')
      .leftJoinAndSelect('participant.discussion', 'discussion')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .getMany();
  }

  findOne(id: string) {
    return this.participantRepository.createQueryBuilder('participant')
      .leftJoinAndSelect('participant.user', 'user')
      .leftJoinAndSelect('participant.discussion', 'discussion')
      .where('participant.trackingId = :id', { id })
      .getOne();
  }
}
