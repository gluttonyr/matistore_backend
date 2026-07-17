import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { MessageRepository } from './message.repository';
import { Message, MessageType } from './entities/message.entity';
import { DiscussionService } from 'src/discussion/discussion.service';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { DiscussionStatus, DiscussionType } from 'src/discussion/entities/discussion.entity';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';
import { ParametreService } from 'src/parametre/parametre.service';
import { PARAMETRE_CODES } from 'src/parametre/parametre.constants';

const DEFAULT_DISCUSSION_REFRESH_DAYS = 2;

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly discussionService: DiscussionService,
    private readonly userService: UtilisateurService,
    private readonly parametreService: ParametreService,
  ) {}

  async create(message: Partial<Message>,discussionStatus?:DiscussionStatus) {
    if(!message.discussion || !message.discussion.trackingId || !message?.sender?.trackingId){
      throw new BadRequestException('Discussion requise pour créer un message');
    }
    const discussion = await this.discussionService.findById(message.discussion.trackingId);
    if (!discussion) {
      throw new BadRequestException('Discussion introuvable');
    }
    const sender = await this.userService.findById(message.sender.trackingId)
    if (!sender) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    if (discussion.type === DiscussionType.FORUM && !discussion.active && sender.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Ce forum est verrouillé, seuls les administrateurs peuvent écrire.');
    }
    discussion.lastMessageAt = new Date();
    if(message.type===MessageType.TEXT){
      discussion.lastMessageContent = message.contenu??'';
    }else if(message.type===MessageType.IMAGE){
      discussion.lastMessageContent = 'Image';
    }else if(message.type===MessageType.AUDIO){
      discussion.lastMessageContent = 'Audio';
    }else if(message.type===MessageType.STICKER){
      discussion.lastMessageContent = 'sticker';
    }
    // discussion.lastMessageContent = message.contenu??'';
    if(discussionStatus){
      discussion.statut=discussionStatus;
    }
    await this.discussionService.update(discussion.trackingId, { lastMessageAt: discussion.lastMessageAt, lastMessageContent: discussion.lastMessageContent, statut: discussion.statut });
    message.discussion= discussion;
    message.sender=sender;
    
    return this.messageRepository.save(this.messageRepository.create(message));
  }

  async findByDiscussion(discussionId: string) {
    const refreshDays = (await this.parametreService.getValue(PARAMETRE_CODES.DISCUSSION_REFRESH))
      ?? DEFAULT_DISCUSSION_REFRESH_DAYS;

    // "refreshDays" jours calendaires en comptant aujourd'hui : ex. 2 = aujourd'hui + hier.
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (refreshDays - 1));

    return this.messageRepository.findByDiscussion(discussionId, since);
  }

  findById(id: string) {
    return this.messageRepository.findById(id);
  }

  countByDiscussion(discussionId: string) {
    return this.messageRepository.countByDiscussion(discussionId);
  }

  /**
   * Marque comme lus tous les messages d'une discussion envoyés par quelqu'un
   * d'autre que `readerUserId`. Appelé quand ce dernier rejoint la room de la
   * discussion (donc quand il est en ligne et a la conversation ouverte).
   */
  async markDiscussionAsRead(discussionId: string, readerUserId: number): Promise<Message[]> {
    const unread = await this.messageRepository.findUnreadForReader(discussionId, readerUserId);
    if (unread.length === 0) {
      return [];
    }
    const now = new Date();
    unread.forEach((message) => {
      message.lu = true;
      message.dateLu = now;
    });
    return this.messageRepository.save(unread);
  }

  async update(id: string, payload: Partial<Message>) {
    const message = await this.findById(id);
    if (!message) {
      throw new BadRequestException('Message introuvable');
    }
    Object.assign(message, payload, { isEdited: true, editedAt: new Date() });
    return this.messageRepository.save(message);
  }

  async remove(id: string, requesterId: number) {
    const message = await this.findById(id);
    if (!message) {
      throw new BadRequestException('Message introuvable');
    }
    const requester = await this.userService.findUserById(requesterId);
    const isOwner = message.sender?.id === requesterId;
    if (requester?.role !== UserRole.ADMIN && !isOwner) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à supprimer ce message');
    }
    return this.messageRepository.remove(message);
  }

  /**
   * Épingle un message (admin uniquement). Un seul message épinglé à la fois
   * par discussion : tout message déjà épinglé dans la même discussion est
   * désépinglé au passage.
   */
  async pin(id: string, requesterId: number): Promise<{ pinned: Message; unpinned?: Message }> {
    const requester = await this.userService.findUserById(requesterId);
    if (requester?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seuls les administrateurs peuvent épingler un message.');
    }
    const message = await this.findById(id);
    if (!message) {
      throw new BadRequestException('Message introuvable');
    }

    const currentlyPinned = await this.messageRepository.findPinned(message.discussion.trackingId);
    const other = currentlyPinned.find((m) => m.trackingId !== id);
    if (other) {
      other.epingle = false;
      await this.messageRepository.save(other);
    }

    message.epingle = true;
    const saved = await this.messageRepository.save(message);
    return { pinned: saved, unpinned: other };
  }

  async unpin(id: string, requesterId: number): Promise<Message> {
    const requester = await this.userService.findUserById(requesterId);
    if (requester?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seuls les administrateurs peuvent désépingler un message.');
    }
    const message = await this.findById(id);
    if (!message) {
      throw new BadRequestException('Message introuvable');
    }
    message.epingle = false;
    return this.messageRepository.save(message);
  }
}
