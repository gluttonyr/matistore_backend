import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushNotificationService } from '../notifications/push-notification.service';
import { PushDeviceService } from '../push-device/push-device.service';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import { AppNotification } from './entities/app-notification.entity';
import { BroadcastAppNotificationDto } from './dto/broadcast-app-notification.dto';

@Injectable()
export class AppNotificationService {
  constructor(
    @InjectRepository(AppNotification)
    private readonly notificationRepository: Repository<AppNotification>,
    private readonly userService: UtilisateurService,
    private readonly pushDeviceService: PushDeviceService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async findForUser(userId: number) {
    const notifications = await this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
    return notifications.map((notification) => this.toResponse(notification));
  }

  async broadcast(dto: BroadcastAppNotificationDto, adminId: number) {
    const title = typeof dto?.title === 'string' ? dto.title.trim() : '';
    const body = typeof dto?.body === 'string' ? dto.body.trim() : '';
    const imageUrl = typeof dto?.imageUrl === 'string' ? dto.imageUrl.trim() : undefined;
    if (!title || !body) throw new BadRequestException('Le titre et le message sont requis');
    if (title.length > 100 || body.length > 500) {
      throw new BadRequestException('Le titre est limité à 100 caractères et le message à 500 caractères');
    }
    if (imageUrl) {
      if (imageUrl.length > 2048) throw new BadRequestException('L’URL de l’image est trop longue');
      try {
        const parsedUrl = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
      } catch {
        throw new BadRequestException('L’image doit être accessible avec une URL HTTP ou HTTPS');
      }
    }

    const recipientIds = await this.userService.findActiveUserIds();
    if (recipientIds.length > 0) {
      await this.notificationRepository.save(
        recipientIds.map((userId) => this.notificationRepository.create({
          title,
          body,
          imageUrl: imageUrl ?? null,
          user: { id: userId } as any,
          createdBy: String(adminId),
          updatedBy: String(adminId),
        })),
      );
    }

    const tokens = await this.pushDeviceService.findActiveTokensForUsers();
    await this.pushNotificationService.sendToTokens(
      tokens,
      title,
      body,
      { type: 'ADMIN_BROADCAST' },
      imageUrl,
    );

    return { recipientCount: tokens.length, storedCount: recipientIds.length };
  }

  private toResponse(notification: AppNotification) {
    return {
      trackingId: notification.trackingId,
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl ?? null,
      createdAt: notification.createdAt,
    };
  }
}
