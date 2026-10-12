import { Expo } from 'expo-server-sdk';
import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    service = new PushNotificationService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports Expo accepted tickets and uses the registered default channel', async () => {
    const send = jest
      .spyOn(Expo.prototype, 'sendPushNotificationsAsync')
      .mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);

    const report = await service.sendToTokens(
      ['ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'],
      'MatiStore',
      'Test push',
    );

    expect(report).toEqual({
      recipientCount: 1,
      attemptedCount: 1,
      deliveredCount: 1,
      failedCount: 0,
      invalidTokens: [],
    });
    expect(send.mock.calls[0][0][0]).toMatchObject({ channelId: 'default' });
  });

  it('reports provider ticket errors and marks unregistered devices for deactivation', async () => {
    jest.spyOn(Expo.prototype, 'sendPushNotificationsAsync').mockResolvedValue([
      {
        status: 'error',
        message: 'The recipient device is not registered.',
        details: { error: 'DeviceNotRegistered' },
      },
    ]);

    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    const report = await service.sendToTokens([token], 'MatiStore', 'Test push');

    expect(report).toEqual({
      recipientCount: 1,
      attemptedCount: 1,
      deliveredCount: 0,
      failedCount: 1,
      invalidTokens: [token],
    });
  });

  it('does not hide Expo transport failures from the delivery report', async () => {
    jest
      .spyOn(Expo.prototype, 'sendPushNotificationsAsync')
      .mockRejectedValue(new Error('Expo is unreachable'));

    const report = await service.sendToTokens(
      ['ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'],
      'MatiStore',
      'Test push',
    );

    expect(report).toMatchObject({
      recipientCount: 1,
      attemptedCount: 1,
      deliveredCount: 0,
      failedCount: 1,
    });
  });

  it('reports malformed stored tokens instead of treating them as sent', async () => {
    const report = await service.sendToTokens(['not-an-expo-token'], 'MatiStore', 'Test push');

    expect(report).toEqual({
      recipientCount: 1,
      attemptedCount: 0,
      deliveredCount: 0,
      failedCount: 1,
      invalidTokens: ['not-an-expo-token'],
    });
  });
});
