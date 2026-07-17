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
      return;
    }

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.logger.error('Erreur envoi notifications push', error as Error);
      }
    }
  }
}
