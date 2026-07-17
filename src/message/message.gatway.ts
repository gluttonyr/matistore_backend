import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessageService } from './message.service';
import { MessageType } from './entities/message.entity';
import { DiscussionStatus } from 'src/discussion/entities/discussion.entity';
import { DiscussionService } from 'src/discussion/discussion.service';
import { MessageMapper } from './mappers/message.mapper';
import { PresenceService } from 'src/presence/presence.service';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly messageMapper: MessageMapper,
    private readonly jwtService: JwtService,
    private readonly presenceService: PresenceService,
    private readonly discussionService: DiscussionService,
    private readonly utilisateurService: UtilisateurService,
  ) { }

  // ==========================
  // PRÉSENCE (utilisateurs en ligne)
  // ==========================
  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      client.data.userId = userId;
      this.presenceService.addConnection(userId, client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.presenceService.removeConnection(userId, client.id);
    }
  }

  // ==========================
  // JOIN ROOM
  // ==========================
  @SubscribeMessage('joinDiscussion')
  async handleJoin(
    @MessageBody() discussionId: string,
    @ConnectedSocket() client: Socket,
  ) {
    console.log("connection etablished")
    client.join(discussionId);

    // Rejoindre la room = être en ligne et avoir la discussion ouverte : on en
    // profite pour marquer comme lus les messages de l'autre côté et prévenir
    // l'expéditeur (double coche) via l'événement "messagesRead".
    const readerId = client.data?.userId;
    if (!readerId) return;

    const updated = await this.messageService.markDiscussionAsRead(discussionId, readerId);
    if (updated.length > 0) {
      const responseMessages = updated.map((message) => this.messageMapper.toResponse(message));
      this.server.to(discussionId).emit('messagesRead', responseMessages);
    }
  }

  // ==========================
  // CREATE MESSAGE
  // ==========================
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody()
    payload: {
      contenu: string;
      discussionId: string;
      senderId: number;
      parentId?: string;
      image?: string;
      type?:MessageType;
      discussionStatut?:DiscussionStatus;
    },
  ) {
    console.log("message send fully with", payload)
    try {
      let parentMessage: any = null;
      if (payload.parentId) {
        parentMessage = await this.messageService.findById(payload.parentId);

        if (!parentMessage) {
          throw new Error('Parent non trouvé');
        }
      }
      const message = await this.messageService.create({
        contenu: payload.contenu,
        discussion: {
          trackingId: payload.discussionId,
        } as any,
        sender: {
          trackingId: payload.senderId,
        } as any,
        parent: parentMessage ? { trackingId: parentMessage.id } as any : undefined,
        image: payload.image,
        type:payload.type

      },payload.discussionStatut);

      const responseMessage = this.messageMapper.toResponse(message);

      this.server
        .to(payload.discussionId)
        .emit('newMessage', responseMessage);

      this.server.emit('discussionUpdated', {
        discussionId: payload.discussionId,
        lastMessageAt: new Date(),
      });

      return responseMessage;
    } catch (error: any) {
      return { success: false, error: error.message ?? "Erreur lors de l'envoi du message" };
    }
  }

  // ==========================
  // UPDATE MESSAGE
  // ==========================
  @SubscribeMessage('updateMessage')
  async handleUpdate(
    @MessageBody()
    payload: {
      messageId: string;
      contenu: string;
    },
  ) {
    const message = await this.messageService.update(
      payload.messageId,
      {
        contenu: payload.contenu,
      },
    );

    const responseMessage = this.messageMapper.toResponse(message);

    this.server
      .to(message.discussion.trackingId)
      .emit('messageUpdated', responseMessage);

    return responseMessage;
  }

  // ==========================
  // DELETE MESSAGE
  // ==========================
  @SubscribeMessage('deleteMessage')
  async handleDelete(
    @MessageBody()
    payload: {
      messageId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const message = await this.messageService.findById(payload.messageId);
      if (!message) {
        return { success: false, error: 'Message introuvable' };
      }

      await this.messageService.remove(payload.messageId, client.data.userId);

      this.server
        .to(message.discussion.trackingId)
        .emit('messageDeleted', {
          messageId: payload.messageId,
        });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message ?? 'Erreur lors de la suppression' };
    }
  }

  // ==========================
  // PIN / UNPIN MESSAGE (admin uniquement)
  // ==========================
  @SubscribeMessage('pinMessage')
  async handlePin(
    @MessageBody() payload: { messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pinned, unpinned } = await this.messageService.pin(payload.messageId, client.data.userId);
      const response = this.messageMapper.toResponse(pinned);
      this.server.to(pinned.discussion.trackingId).emit('messageUpdated', response);
      if (unpinned) {
        this.server.to(pinned.discussion.trackingId).emit('messageUpdated', this.messageMapper.toResponse(unpinned));
      }
      return response;
    } catch (error: any) {
      return { success: false, error: error.message ?? "Erreur lors de l'épinglage" };
    }
  }

  @SubscribeMessage('unpinMessage')
  async handleUnpin(
    @MessageBody() payload: { messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const message = await this.messageService.unpin(payload.messageId, client.data.userId);
      const response = this.messageMapper.toResponse(message);
      this.server.to(message.discussion.trackingId).emit('messageUpdated', response);
      return response;
    } catch (error: any) {
      return { success: false, error: error.message ?? 'Erreur lors du désépinglage' };
    }
  }

  // ==========================
  // VERROUILLAGE DE LA DISCUSSION (admin uniquement — utilisé pour le forum)
  // ==========================
  @SubscribeMessage('toggleDiscussionLock')
  async handleToggleLock(
    @MessageBody() payload: { discussionId: string; active: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const requester = await this.utilisateurService.findUserById(client.data.userId);
      if (requester?.role !== UserRole.ADMIN) {
        return { success: false, error: 'Action réservée aux administrateurs.' };
      }
      const discussion = await this.discussionService.update(payload.discussionId, { active: payload.active });
      const result = { discussionId: payload.discussionId, active: discussion.active };
      this.server.to(payload.discussionId).emit('discussionLockChanged', result);
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message ?? 'Erreur lors du verrouillage' };
    }
  }
}