// message.repository.ts
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageRepository extends Repository<Message> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Message, dataSource.createEntityManager());
  }

  /**
   * - Sans `until` : chargement initial → fenêtre glissante de `since` à maintenant,
   *   plus tous les messages non lus (même plus anciens que `since`), comme avant.
   * - Avec `until` : chargement d'une tranche historique → strictement entre
   *   `since` et `until` (utilisé par le "charger plus" en scrollant vers le haut).
   */
  findByDiscussion(discussionId: string, since?: Date, until?: Date) {
    const query = this.createQueryBuilder('message')
      .leftJoinAndSelect('message.discussion', 'discussion')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .orderBy('message.createdAt', 'ASC');

    if (until) {
      query.andWhere('message.createdAt < :until', { until });
      if (since) {
        query.andWhere('message.createdAt >= :since', { since });
      }
    } else if (since) {
      query.andWhere('(message.createdAt >= :since OR message.lu = false)', { since });
    }

    return query.getMany();
  }

  findById(id: string) {
    return this.findOne({
      where: { trackingId: id },
      relations: { sender: true, reactions: true, discussion: true },
    });
  }

  findPinned(discussionId: string) {
    return this.createQueryBuilder('message')
      .leftJoinAndSelect('message.discussion', 'discussion')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .andWhere('message.epingle = true')
      .getMany();
  }

  countByDiscussion(discussionId: string) {
    return this.createQueryBuilder('message')
      .leftJoin('message.discussion', 'discussion')
      .where('discussion.trackingId = :discussionId', { discussionId })
      .getCount();
  }

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