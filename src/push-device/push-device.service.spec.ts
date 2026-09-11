import { Test } from '@nestjs/testing';
import { PushDeviceService } from './push-device.service';
import { PushDeviceRepository } from './push-device.repository';

describe('PushDeviceService', () => {
  it('should register and find devices for a user', async () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, trackingId: 'dev-1' })),
      find: jest.fn(async () => [{ trackingId: 'dev-1' }]),
      findByToken: jest.fn(async () => null),
      findById: jest.fn(async () => null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PushDeviceService,
        {
          provide: PushDeviceRepository,
          useValue: repo,
        },
        {
          provide: 'UTILISATEUR_SERVICE',
          useValue: {
            findUserById: jest.fn(async () => ({ id: 7, trackingId: 'user-7' })),
          },
        },
      ],
    }).compile();

    const service = moduleRef.get(PushDeviceService);

    const device = await service.registerForUser(7, {
      token: 'token-123',
      platform: 'android',
      deviceId: 'device-1',
      active: true,
    });

    expect(device).toBeDefined();
    expect(device.token).toBe('token-123');
    expect(device.platform).toBe('android');
  });
});
