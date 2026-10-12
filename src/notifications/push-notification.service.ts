import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

export interface PushDeliveryReport {
  recipientCount: number;
  attemptedCount: number;
  deliveredCount: number;
  failedCount: number;
  invalidTokens: string[];
}

@Injectable()
export class PushNotificationService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(PushNotificationService.name);

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
    imageUrl?: string,
  ): Promise<PushDeliveryReport> {
    const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
    const invalidTokens: string[] = tokens.filter((token) => !Expo.isExpoPushToken(token));
    if (validTokens.length === 0) {
      this.logger.warn(JSON.stringify({
        event: 'push.skipped.invalid-tokens',
        receivedTokenCount: tokens.length,
      }));
      return {
        recipientCount: tokens.length,
        attemptedCount: 0,
        deliveredCount: 0,
        failedCount: tokens.length,
        invalidTokens,
      };
    }

    this.logger.log(JSON.stringify({
      event: 'push.expo.prepared',
      receivedTokenCount: tokens.length,
      validTokenCount: validTokens.length,
      invalidTokenCount: tokens.length - validTokens.length,
      notificationType: data?.type,
    }));

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      channelId: 'default',
      sound: 'default',
      title,
      body,
      data,
      ...(imageUrl ? { mutableContent: true } : {}),
      ...(imageUrl ? { richContent: { image: imageUrl } } : {}),
    } as ExpoPushMessage));

    const chunks = this.expo.chunkPushNotifications(messages);
    let deliveredCount = 0;
    let failedCount = tokens.length - validTokens.length;
    for (const [chunkIndex, chunk] of chunks.entries()) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, ticketIndex) => {
          if (ticket.status === 'ok') {
            deliveredCount += 1;
          } else {
            failedCount += 1;
            const error = ticket.details?.error ?? ticket.message ?? 'unknown';
            if (error === 'DeviceNotRegistered') {
              invalidTokens.push(chunk[ticketIndex].to as string);
            }
            this.logger.warn(JSON.stringify({
              event: 'push.expo.ticket.failed',
              chunkIndex,
              ticketIndex,
              error,
            }));
          }
        });
        if (tickets.length < chunk.length) {
          failedCount += chunk.length - tickets.length;
        }
      } catch (error) {
        failedCount += chunk.length;
        this.logger.error(
          JSON.stringify({
            event: 'push.expo.request.failed',
            chunkIndex,
            chunkSize: chunk.length,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    return {
      recipientCount: tokens.length,
      attemptedCount: validTokens.length,
      deliveredCount,
      failedCount,
      invalidTokens,
    };
  }
}
