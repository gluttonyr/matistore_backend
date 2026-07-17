import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageRepository extends Repository<Message> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Message, dataSource.createEntityManager());
  }

  findByDiscussion(discussionId: string, since?: Date) {
    const query = this.createQueryBuilder('message')
      .leftJoinAndSelect('message.discussion', 'discussion')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .orderBy('message.createdAt', 'ASC');

    if (since) {
      query.andWhere('message.createdAt >= :since', { since });
    }

    return query.getMany();
  }

  findById(id: string) {
    return this.findOne({
      where: { trackingId: id },
      relations: { sender: true, reactions: true, discussion: true },
    });
  }

  /** Message(s) actuellement épinglé(s) dans une discussion (normalement 0 ou 1). */
  findPinned(discussionId: string) {
    return this.createQueryBuilder('message')
      .leftJoinAndSelect('message.discussion', 'discussion')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .andWhere('message.epingle = true')
      .getMany();
  }

  /** Compte total (sans limite de fenêtre de jours, contrairement à findByDiscussion). */
  countByDiscussion(discussionId: string) {
    return this.createQueryBuilder('message')
      .leftJoin('message.discussion', 'discussion')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .getCount();
  }

  /** Messages non lus d'une discussion, envoyés par quelqu'un d'autre que le lecteur. */
  findUnreadForReader(discussionId: string, readerUserId: number) {
    return this.createQueryBuilder('message')
      .leftJoinAndSelect('message.discussion', 'discussion')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .andWhere('message.lu = false')
      .andWhere('sender.id != :readerUserId', { readerUserId })
      .getMany();
  }
}
