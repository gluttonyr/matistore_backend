import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DiscussionParticipant } from './entities/discussion-participant.entity';

@Injectable()
export class DiscussionParticipantRepository extends Repository<DiscussionParticipant> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(DiscussionParticipant, dataSource.createEntityManager());
  }

  findByDiscussion(discussionId: string) {
    return this.createQueryBuilder('participant')
      .leftJoinAndSelect('participant.discussion', 'discussion')
      .leftJoinAndSelect('participant.user', 'user')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .getMany();
  }

  findOneById(id: string) {
    return this.findOne({
      where: { trackingId: id }, relations: {
        discussion: true,
        user: true,
      }
    });
  }
}
