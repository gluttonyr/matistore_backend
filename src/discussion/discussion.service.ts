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

  countByType(type: DiscussionType) {
    return this.discussionRepository.countByType(type);
  }

  findWithUnreadForAdmin() {
    return this.discussionRepository.findWithUnreadForAdmin();
  }

  async countUnreadForAdmin(): Promise<number> {
    const discussions = await this.discussionRepository.findWithUnreadForAdmin();
    return discussions.reduce((sum, d) => sum + (d.messages?.length ?? 0), 0);
  }

  async countUnreadForUser(userId: number): Promise<number> {
    const discussions = await this.discussionRepository.findWithUnreadForUser(userId);
    return discussions.reduce((sum, d) => sum + (d.messages?.length ?? 0), 0);
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

  findAll() {
    
    return this.discussionRepository
      .createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'user')
      .leftJoinAndSelect('discussion.messages', 'messages')
      .orderBy('discussion.lastMessageAt', 'DESC')
      .where('discussion.type != :type', { type: DiscussionType.FORUM })
      .getMany();
  }

  findById(id: string) {
    return this.discussionRepository
      .createQueryBuilder('discussion')
      .leftJoinAndSelect('discussion.participants', 'participants')
      .leftJoinAndSelect('discussion.messages', 'messages')
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
}