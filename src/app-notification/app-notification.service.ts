import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  /** Coupon notifications carry the coupon, so the list can show it as a ticket. */
  private async withCoupons(items: AppNotification[]) {
    const ids = items.map((n) => n.link?.startsWith('coupon:') ? n.link.slice(7) : null).filter((id): id is string => !!id);
    const coupons = new Map<string, any>();
    if (ids.length) {
      const rows: any[] = await this.dataSource.query(
        `SELECT c.id, c.number, c.image_url AS "imageUrl", c.codes, c.odds, c.note, c.status, c.created_at AS "createdAt"
         FROM coupons c WHERE c.id = ANY($1::uuid[])`,
        [ids],
      ).catch(() => []);
      rows.forEach((row) => coupons.set(row.id, row));
    }
    return items.map((n) => ({
      ...this.toResponse(n),
      coupon: n.link?.startsWith('coupon:') ? coupons.get(n.link.slice(7)) ?? null : null,
    }));
  }

  async findForUser(userId: number, pagination?: { limit: number; beforeId?: number }) {
    if (pagination) {
      const notifications = await this.notificationRepository.find({
        where: pagination.beforeId === undefined
          ? { user: { id: userId } }
          : { user: { id: userId }, id: LessThan(pagination.beforeId) },
        order: { id: 'DESC' },
        take: pagination.limit + 1,
      });
      const hasMore = notifications.length > pagination.limit;
      const items = notifications.slice(0, pagination.limit);
      return {
        items: await this.withCoupons(items),
        hasMore,
        nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      };
    }

    const notifications = await this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return this.withCoupons(notifications);
  }

  async createForUser(userId: number, title: string, body: string) {
    const notification = await this.notificationRepository.save(
      this.notificationRepository.create({
        title,
        body,
        user: { id: userId } as any,
        createdBy: 'system:transaction',
        updatedBy: 'system:transaction',
      }),
    );
    return this.toResponse(notification);
  }

  async broadcast(
    dto: BroadcastAppNotificationDto,
    adminId: number,
    extras?: { link?: string; pushData?: Record<string, unknown> },
  ) {
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
          link: extras?.link ?? null,
          user: { id: userId } as any,
          createdBy: String(adminId),
          updatedBy: String(adminId),
        })),
      );
    }

    const tokens = await this.pushDeviceService.findActiveTokensForUsers();
    const delivery = await this.pushNotificationService.sendToTokens(
      tokens,
      title,
      body,
      extras?.pushData ?? { type: 'ADMIN_BROADCAST' },
      imageUrl,
    );
    await this.pushDeviceService.deactivateTokens(delivery.invalidTokens);

    return {
      recipientCount: delivery.recipientCount,
      attemptedCount: delivery.attemptedCount,
      deliveredCount: delivery.deliveredCount,
      failedCount: delivery.failedCount,
      storedCount: recipientIds.length,
    };
  }

  private toResponse(notification: AppNotification) {
    return {
      trackingId: notification.trackingId,
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl ?? null,
      link: notification.link ?? null,
      createdAt: notification.createdAt,
    };
  }
}
