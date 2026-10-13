import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Discussion, DiscussionStatus, DiscussionType } from './entities/discussion.entity';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';
import { Message } from 'src/message/entities/message.entity';

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

  async findAdminPage(page: number, limit: number, search: string, category: string) {
    const query = this.createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'participantUser')
      .select([
        'discussion.id',
        'discussion.trackingId',
        'discussion.titre',
        'discussion.type',
        'discussion.statut',
        'discussion.active',
        'discussion.image',
        'discussion.lastMessageAt',
        'discussion.lastMessageContent',
        'discussion.createdAt',
        'discussion.updatedAt',
        'participants.id',
        'participants.trackingId',
        'participants.isAdmin',
        'participantUser.id',
        'participantUser.trackingId',
        'participantUser.nom',
        'participantUser.prenom',
        'participantUser.username',
      ])
      .where('discussion.type != :forumType', { forumType: DiscussionType.FORUM });

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query.andWhere(new Brackets((where) => {
        where.where('participantUser.nom ILIKE :term', { term })
          .orWhere('participantUser.prenom ILIKE :term', { term })
          .orWhere('participantUser.username ILIKE :term', { term })
          .orWhere('participantUser.email ILIKE :term', { term })
          .orWhere('participantUser.telephone ILIKE :term', { term });
      }));
    }

    if (category === 'depot') {
      query.andWhere('discussion.statut = :depotStatus', { depotStatus: DiscussionStatus.DEPOT });
    } else if (category === 'retrait') {
      query.andWhere('discussion.statut = :withdrawalStatus', { withdrawalStatus: DiscussionStatus.RETRAIT });
    } else if (category === 'support') {
      query.andWhere(new Brackets((where) => {
        where.where('discussion.type = :supportType', { supportType: DiscussionType.SUPPORT })
          .orWhere('discussion.statut = :otherStatus', { otherStatus: DiscussionStatus.AUTRE });
      }));
    } else if (category === 'unread') {
      query.innerJoin('discussion.messages', 'unreadMessage', 'unreadMessage.lu = false')
        .innerJoin('unreadMessage.sender', 'unreadSender', 'unreadSender.role != :adminRole', { adminRole: UserRole.ADMIN });
    }

    const total = await query.clone().getCount();
    const discussions = await query
      .orderBy('discussion.lastMessageAt', 'DESC')
      .addOrderBy('discussion.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const ids = discussions.map((discussion) => discussion.trackingId);
    const unreadCounts = await this.countUnreadByDiscussionForAdmin(ids);

    const unreadByDiscussion = new Map(unreadCounts.map((row) => [row.discussionId, Number(row.unreadCount)]));
    const [allCount, unreadCount, depositCount, withdrawalCount, supportCount] = await Promise.all([
      this.createQueryBuilder('discussion').where('discussion.type != :forumType', { forumType: DiscussionType.FORUM }).getCount(),
      this.createQueryBuilder('discussion')
        .innerJoin('discussion.messages', 'message', 'message.lu = false')
        .innerJoin('message.sender', 'sender', 'sender.role != :adminRole', { adminRole: UserRole.ADMIN })
        .where('discussion.type != :forumType', { forumType: DiscussionType.FORUM })
        .select('COUNT(DISTINCT discussion.id)', 'count')
        .getRawOne<{ count: string }>(),
      this.createQueryBuilder('discussion').where('discussion.type != :forumType', { forumType: DiscussionType.FORUM }).andWhere('discussion.statut = :status', { status: DiscussionStatus.DEPOT }).getCount(),
      this.createQueryBuilder('discussion').where('discussion.type != :forumType', { forumType: DiscussionType.FORUM }).andWhere('discussion.statut = :status', { status: DiscussionStatus.RETRAIT }).getCount(),
      this.createQueryBuilder('discussion')
        .where('discussion.type != :forumType', { forumType: DiscussionType.FORUM })
        .andWhere(new Brackets((where) => where
          .where('discussion.type = :supportType', { supportType: DiscussionType.SUPPORT })
          .orWhere('discussion.statut = :otherStatus', { otherStatus: DiscussionStatus.AUTRE })))
        .getCount(),
    ]);

    return {
      discussions,
      total,
      unreadByDiscussion,
      counts: {
        all: allCount,
        unread: Number(unreadCount?.count ?? 0),
        depot: depositCount,
        retrait: withdrawalCount,
        support: supportCount,
      },
    };
  }

  /**
   * Discussions (hors forum) ayant au moins un message non lu envoyé par un
   * utilisateur (pas un admin). `discussion.messages` ne contient QUE ces
   * messages non lus (jointure filtrée) : `messages.length` = compteur non lu.
   */
  findWithUnreadForAdmin() {
    return this.createQueryBuilder('discussion')
      .innerJoin('discussion.messages', 'message', 'message.lu = false')
      .innerJoin('message.sender', 'sender', 'sender.role != :role', { role: UserRole.ADMIN })
      .leftJoinAndSelect('discussion.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'participantUser')
      .select([
        'discussion.id',
        'discussion.trackingId',
        'discussion.titre',
        'discussion.type',
        'discussion.statut',
        'discussion.active',
        'discussion.image',
        'discussion.lastMessageAt',
        'discussion.lastMessageContent',
        'discussion.createdAt',
        'discussion.updatedAt',
        'participants.id',
        'participants.trackingId',
        'participants.isAdmin',
        'participantUser.id',
        'participantUser.trackingId',
        'participantUser.nom',
        'participantUser.prenom',
        'participantUser.username',
      ])
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .orderBy('discussion.lastMessageAt', 'DESC')
      .distinct(true)
      .getMany();
  }

  /**
   * Discussions (hors forum) où `userId` est participant et a au moins un
   * message non lu qu'il n'a pas envoyé lui-même. Même principe que
   * `findWithUnreadForAdmin` mais borné à un utilisateur précis.
   */
  findWithUnreadForUser(userId: number) {
    return this.createQueryBuilder('discussion')
      .innerJoin('discussion.messages', 'message', 'message.lu = false')
      .innerJoin('message.sender', 'sender')
      .innerJoin('discussion.participants', 'participant')
      .innerJoin('participant.user', 'participantUser')
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .andWhere('participantUser.id = :userId', { userId })
      .andWhere('sender.id != :userId', { userId })
      .getMany();
  }

  countUnreadMessagesForAdmin() {
    return this.createQueryBuilder('discussion')
      .innerJoin('discussion.messages', 'message', 'message.lu = false')
      .innerJoin('message.sender', 'sender', 'sender.role != :role', { role: UserRole.ADMIN })
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .select('COUNT(message.id)', 'count')
      .getRawOne<{ count: string }>();
  }

  countUnreadMessagesForUser(userId: number) {
    return this.createQueryBuilder('discussion')
      .innerJoin('discussion.messages', 'message', 'message.lu = false')
      .innerJoin('message.sender', 'sender', 'sender.id != :userId', { userId })
      .innerJoin('discussion.participants', 'participant')
      .innerJoin('participant.user', 'participantUser', 'participantUser.id = :userId', { userId })
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .select('COUNT(message.id)', 'count')
      .getRawOne<{ count: string }>();
  }

  countUnreadByDiscussionForAdmin(ids: string[]) {
    if (!ids.length) return Promise.resolve([] as { discussionId: string; unreadCount: string }[]);
    return this.manager.getRepository(Message)
      .createQueryBuilder('message')
      .innerJoin('message.discussion', 'discussion')
      .innerJoin('message.sender', 'sender')
      .select('discussion.trackingId', 'discussionId')
      .addSelect('COUNT(message.id)', 'unreadCount')
      .where('discussion.trackingId IN (:...ids)', { ids })
      .andWhere('message.lu = false')
      .andWhere('sender.role != :adminRole', { adminRole: UserRole.ADMIN })
      .groupBy('discussion.trackingId')
      .getRawMany<{ discussionId: string; unreadCount: string }>();
  }

  findById(id: string) {
    return this.createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participants')
      .where('discussion.trackingId = :id', { id })
      .getOne();
  }
}
