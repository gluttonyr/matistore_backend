import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Discussion, DiscussionType } from './entities/discussion.entity';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';

@Injectable()
export class DiscussionRepository extends Repository<Discussion> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Discussion, dataSource.createEntityManager());
  }

  countByType(type: DiscussionType) {
    return this.createQueryBuilder('discussion')
      .where('discussion.type = :type', { type })
      .getCount();
  }

  /**
   * Discussions (hors forum) ayant au moins un message non lu envoyé par un
   * utilisateur (pas un admin). `discussion.messages` ne contient QUE ces
   * messages non lus (jointure filtrée) : `messages.length` = compteur non lu.
   */
  findWithUnreadForAdmin() {
    return this.createQueryBuilder('discussion')
      .innerJoinAndSelect('discussion.messages', 'message', 'message.lu = false')
      .innerJoin('message.sender', 'sender')
      .leftJoinAndSelect('discussion.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'participantUser')
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .andWhere('sender.role != :role', { role: UserRole.ADMIN })
      .orderBy('discussion.lastMessageAt', 'DESC')
      .getMany();
  }

  /**
   * Discussions (hors forum) où `userId` est participant et a au moins un
   * message non lu qu'il n'a pas envoyé lui-même. Même principe que
   * `findWithUnreadForAdmin` mais borné à un utilisateur précis.
   */
  findWithUnreadForUser(userId: number) {
    return this.createQueryBuilder('discussion')
      .innerJoinAndSelect('discussion.messages', 'message', 'message.lu = false')
      .innerJoin('message.sender', 'sender')
      .innerJoin('discussion.participants', 'participant')
      .innerJoin('participant.user', 'participantUser')
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .andWhere('participantUser.id = :userId', { userId })
      .andWhere('sender.id != :userId', { userId })
      .getMany();
  }

  findAllWithRelations() {
    return this.createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participants')
      .leftJoinAndSelect('discussion.messages', 'messages')
      .getMany();
  }

  findById(id: string) {
    return this.createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participants')
      .leftJoinAndSelect('discussion.messages', 'messages')
      .where('discussion.trackingId = :id', { id })
      .getOne();
  }
}
