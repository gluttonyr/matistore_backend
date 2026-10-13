import { Injectable, BadRequestException, OnApplicationBootstrap, NotFoundException } from '@nestjs/common';
import { DiscussionRepository } from './discussion.repository';
import { Discussion, DiscussionStatus, DiscussionType } from './entities/discussion.entity';
import { User } from 'src/utilisateur/entities/user.entity';
import { DiscussionParticipantService } from 'src/discussion-participant/discussion-participant.service';
import { DiscussionParticipant } from 'src/discussion-participant/entities/discussion-participant.entity';

@Injectable()
export class DiscussionService implements OnApplicationBootstrap {
  constructor(private readonly discussionRepository: DiscussionRepository, private readonly discussionParticipantService: DiscussionParticipantService) {}

  async onApplicationBootstrap() {
    await this.ensureForumExists();
  }

  private async ensureForumExists() {
    
    const forumExists = await this.discussionRepository
      .createQueryBuilder('discussion')
      .where('discussion.type = :type', { type: DiscussionType.FORUM })
      .getOne();

    if (!forumExists) {
      await this.discussionRepository.save(
        this.discussionRepository.create({
          titre: 'Forum général',
          type: DiscussionType.FORUM,
          statut: DiscussionStatus.AUTRE,
          
        }),
      );

 
    }
  }


getDiscussionByUser(userId: string) {
  return this.discussionRepository
    .createQueryBuilder('discussion')
    .innerJoinAndSelect('discussion.participants', 'participants')
    
    .innerJoinAndSelect('participants.user', 'user')
    .where('user.trackingId = :trackingId', { trackingId: userId })
    .getMany();
}

  getDiscussionByType(type: DiscussionType) {
    return this.discussionRepository
      .createQueryBuilder('discussion')
      .where('discussion.type = :type', { type })
      .getMany();
  }

  // Contrat historique non paginé, sans charger l'historique des messages.
  async findAll() {
    const discussions = await this.discussionRepository
      .createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'user')
      .orderBy('discussion.lastMessageAt', 'DESC')
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .getMany();

    const unreadCounts = await this.discussionRepository.countUnreadByDiscussionForAdmin(
      discussions.map((discussion) => discussion.trackingId),
    );
    const unreadByDiscussion = new Map(
      unreadCounts.map((row) => [row.discussionId, Number(row.unreadCount)]),
    );
    return { discussions, unreadByDiscussion };
  }

  async getDepotRetraitDiscussion(userId: number): Promise<Discussion> {
    const discussion = await this.discussionRepository
      .createQueryBuilder('discussion')
      .innerJoin('discussion.participants', 'participants')
      .innerJoin('participants.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('discussion.type = :type', { type: DiscussionType.DEPOT_RETRAIT })
      .getOne();

    if (!discussion) {
      throw new NotFoundException('Discussion dépôt/retrait introuvable pour cet utilisateur');
    }
    return discussion;
  }

  countByType(type: DiscussionType) {
    return this.discussionRepository.countByType(type);
  }

  async findWithUnreadForAdmin() {
    const discussions = await this.discussionRepository.findWithUnreadForAdmin();
    const unreadCounts = await this.discussionRepository.countUnreadByDiscussionForAdmin(
      discussions.map((discussion) => discussion.trackingId),
    );
    const unreadByDiscussion = new Map(unreadCounts.map((row) => [row.discussionId, Number(row.unreadCount)]));
    return { discussions, unreadByDiscussion };
  }

  findAdminPage(page: number, limit: number, search: string, category: string) {
    return this.discussionRepository.findAdminPage(page, limit, search, category);
  }

  async getAdminUserProfile(discussionId: string) {
    const discussion = await this.discussionRepository.findOne({
      where: { trackingId: discussionId },
      select: { id: true },
    });
    if (!discussion) throw new NotFoundException('Discussion introuvable');

    const row = await this.discussionRepository.manager
      .getRepository(DiscussionParticipant)
      .createQueryBuilder('participant')
      .innerJoinAndSelect('participant.user', 'user')
      .innerJoin('participant.discussion', 'discussion')
      .where('discussion.id = :discussionId', { discussionId: discussion.id })
      .andWhere('participant.isAdmin = false')
      .select([
        'participant.id',
        'user.id',
        'user.trackingId',
        'user.nom',
        'user.prenom',
        'user.username',
        'user.email',
        'user.telephone',
        'user.active',
        'user.createdAt',
      ])
      .getOne();

    if (!row?.user) throw new NotFoundException('Profil utilisateur introuvable');
    const user = row.user;
    return {
      trackingId: user.trackingId,
      nom: user.nom,
      prenom: user.prenom,
      username: user.username,
      email: user.email,
      telephone: user.telephone,
      active: user.active,
      createdAt: user.createdAt,
    };
  }

  async countUnreadForAdmin(): Promise<number> {
    const result = await this.discussionRepository.countUnreadMessagesForAdmin();
    return Number(result?.count ?? 0);
  }

  async countUnreadForUser(userId: number): Promise<number> {
    const result = await this.discussionRepository.countUnreadMessagesForUser(userId);
    return Number(result?.count ?? 0);
  }

  async getUserByDiscussionId(discussionId: string): Promise<User> {
  const user = await this.discussionRepository.manager
    .createQueryBuilder(User, 'user')
    .innerJoin('user.discussionParticipants', 'participant')
    .innerJoin('participant.discussion', 'discussion')
    .where('discussion.trackingId = :discussionId', { discussionId })
    .getOne();

  if (!user) {
    throw new NotFoundException(
      `Aucun utilisateur trouvé pour la discussion ${discussionId}`,
    );
  }

  return user;
}

  create(discussion: Partial<Discussion>) {
    return this.discussionRepository.save(
      this.discussionRepository.create(discussion),
    );
  }
  async createForUser(user:User) {
    const discussionSupport = this.discussionRepository.create({
      titre: `Support MATISTORE`,
      type: DiscussionType.SUPPORT,
      
      statut: DiscussionStatus.AUTRE,
    });
    const discussionTransaction = this.discussionRepository.create({
      titre: `Dépôt / Retrait`,
      type: DiscussionType.DEPOT_RETRAIT,
      statut: DiscussionStatus.DEPOT,
    });
    const discussionParticipant1 = new DiscussionParticipant();
    discussionParticipant1.user = user;
    discussionParticipant1.joinedAt = new Date();
    discussionParticipant1.discussion = discussionSupport;

    const discussionParticipant2 = new DiscussionParticipant();
    discussionParticipant2.user = user;
    discussionParticipant2.joinedAt = new Date();
    discussionParticipant2.discussion = discussionTransaction;

    
    
    
    discussionParticipant1.discussion= await this.discussionRepository.save(discussionSupport);
    discussionParticipant2.discussion = await this.discussionRepository.save(discussionTransaction);
    this.discussionParticipantService.addParticipant(discussionParticipant1);
    this.discussionParticipantService.addParticipant(discussionParticipant2);

  }

  findById(id: string) {
    return this.discussionRepository
      .createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participants')
      .where('discussion.trackingId = :id', { id })
      .getOne();
  }

  async update(id: string, payload: Partial<Discussion>) {
    const discussion = await this.findById(id);
    if (!discussion) {
      throw new BadRequestException('Discussion introuvable');
    }
    Object.assign(discussion, payload);
    return this.discussionRepository.save(discussion);
  }

  async remove(id: string) {
    const discussion = await this.findById(id);
    if (!discussion) {
      throw new BadRequestException('Discussion introuvable');
    }
    return this.discussionRepository.remove(discussion);
  }

  async getParticipantUserIds(discussionId: string): Promise<number[]> {
  const discussion = await this.discussionRepository
    .createQueryBuilder('discussion')
    .innerJoinAndSelect('discussion.participants', 'participants')
    .innerJoinAndSelect('participants.user', 'user')
    .where('discussion.trackingId = :discussionId', { discussionId })
    .getOne();

  return discussion?.participants.map((p) => p.user.id) ?? [];
}
}
