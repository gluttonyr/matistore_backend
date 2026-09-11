import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { MessageRepository } from './message.repository';
import { Message, MessageType } from './entities/message.entity';
import { DiscussionService } from 'src/discussion/discussion.service';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { DiscussionStatus, DiscussionType } from 'src/discussion/entities/discussion.entity';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';
import { ParametreService } from 'src/parametre/parametre.service';
import { PARAMETRE_CODES } from 'src/parametre/parametre.constants';
import { PushDeviceService } from 'src/push-device/push-device.service';
import { PushNotificationService } from 'src/notifications/push-notification.service';

const DEFAULT_DISCUSSION_REFRESH_DAYS = 2;

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly discussionService: DiscussionService,
    private readonly userService: UtilisateurService,
    private readonly parametreService: ParametreService,
    private readonly pushDeviceService: PushDeviceService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async create(message: Partial<Message>, discussionStatus?: DiscussionStatus) {
    if (!message.discussion || !message.discussion.trackingId || !message?.sender?.trackingId) {
      throw new BadRequestException('Discussion requise pour créer un message');
    }
    const discussion = await this.discussionService.findById(message.discussion.trackingId);
    if (!discussion) {
      throw new BadRequestException('Discussion introuvable');
    }
    const sender = await this.userService.findById(message.sender.trackingId);
    if (!sender) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    if (discussion.type === DiscussionType.FORUM && !discussion.active && sender.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Ce forum est verrouillé, seuls les administrateurs peuvent écrire.');
    }
    discussion.lastMessageAt = new Date();
    if (message.type === MessageType.TEXT) {
      discussion.lastMessageContent = message.contenu ?? '';
    } else if (message.type === MessageType.IMAGE) {
      discussion.lastMessageContent = 'Image';
    } else if (message.type === MessageType.AUDIO) {
      discussion.lastMessageContent = 'Audio';
    } else if (message.type === MessageType.STICKER) {
      discussion.lastMessageContent = 'sticker';
    }
    if (discussionStatus) {
      discussion.statut = discussionStatus;
    }
    await this.discussionService.update(discussion.trackingId, {
      lastMessageAt: discussion.lastMessageAt,
      lastMessageContent: discussion.lastMessageContent,
      statut: discussion.statut,
    });
    message.discussion = discussion;
    message.sender = sender;

    const saved = await this.messageRepository.save(this.messageRepository.create(message));

    // Notifier sans bloquer/faire échouer l'envoi du message si le push rate.
    this.notifyNewMessage(saved).catch((error) =>
      this.logger.error('Échec de la notification du nouveau message', error),
    );

    return saved;
  }

  private buildNotificationBody(message: Message): string {
    switch (message.type) {
      case MessageType.TEXT:
        return message.contenu ?? '';
      case MessageType.IMAGE:
        return '📷 Image';
      case MessageType.AUDIO:
        return '🎤 Message vocal';
      case MessageType.STICKER:
        return 'Sticker';
      default:
        return 'Nouveau message';
    }
  }

  private async notifyNewMessage(message: Message): Promise<void> {
    const isSenderAdmin = message.sender.role === UserRole.ADMIN;
    let tokens: string[];

    if (isSenderAdmin) {
      // Admin écrit → notifier le(s) participant(s) client de la discussion
      const participantIds = await this.discussionService.getParticipantUserIds(
        message.discussion.trackingId,
      );
      const devicesByUser = await Promise.all(
        participantIds.map((id) => this.pushDeviceService.findActiveByUser(id)),
      );
      tokens = devicesByUser.flat().map((d) => d.token);
    } else {
      // Utilisateur écrit → notifier tous les admins
      tokens = await this.userService.getAdminPushTokens();
    }

    if (tokens.length === 0) return;

    const senderName = isSenderAdmin
      ? 'MatiStore Support'
      : `${message.sender.nom ?? ''} ${message.sender.prenom ?? ''}`.trim() || 'Nouveau message';

    await this.pushNotificationService.sendToTokens(
      tokens,
      senderName,
      this.buildNotificationBody(message),
      { type: 'message', discussionId: message.discussion.trackingId },
    );
  }

  async findByDiscussion(discussionId: string) {
    const refreshDays =
      (await this.parametreService.getValue(PARAMETRE_CODES.DISCUSSION_REFRESH)) ??
      DEFAULT_DISCUSSION_REFRESH_DAYS;

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
    // const isOwner = message.sender?.id === requesterId;
    if (requester?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à supprimer ce message');
    }
    //  if (requester?.role !== UserRole.ADMIN && !isOwner) {
    //   throw new ForbiddenException('Vous n\'êtes pas autorisé à supprimer ce message');
    // }
    return this.messageRepository.remove(message);
  }

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