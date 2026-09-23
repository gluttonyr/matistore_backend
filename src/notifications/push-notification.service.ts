import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class PushNotificationService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(PushNotificationService.name);

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
    if (validTokens.length === 0) {
      this.logger.warn(JSON.stringify({
        event: 'push.skipped.invalid-tokens',
        receivedTokenCount: tokens.length,
      }));
      return;
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
      sound: 'default',
      title,
      body,
      data,
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const [chunkIndex, chunk] of chunks.entries()) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        const errors = tickets.reduce<Array<{ ticketIndex: number; error: string }>>(
          (result, ticket, ticketIndex) => {
            if (ticket.status === 'error') {
              result.push({
                ticketIndex,
                error: ticket.details?.error ?? ticket.message ?? 'unknown',
              });
            }
            return result;
          },
          [],
        );

        this.logger.log(JSON.stringify({
          event: 'push.expo.tickets.received',
          chunkIndex,
          ticketCount: tickets.length,
          acceptedCount: tickets.length - errors.length,
          errorCount: errors.length,
          errors,
        }));
      } catch (error) {
        this.logger.error(
          JSON.stringify({ event: 'push.expo.request.failed', chunkIndex, chunkSize: chunk.length }),
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
