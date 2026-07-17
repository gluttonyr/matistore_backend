import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MessageReaction } from './entities/message-reaction.entity';

@Injectable()
export class MessageReactionRepository extends Repository<MessageReaction> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(MessageReaction, dataSource.createEntityManager());
  }

  findByMessage(messageId: string) {
    return this.createQueryBuilder('reaction')
      .leftJoinAndSelect('reaction.message', 'message')
      .leftJoinAndSelect('reaction.user', 'user')
      .where('message.trackingId = :messageId', { messageId })
      .getMany();
  }

  findOneById(id: string) {
    return this.findOne({
      where: { trackingId: id }, relations: {
        message: true,
        user: true,
      }
    });
  }
}
