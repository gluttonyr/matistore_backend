import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SmsCaptureController } from './sms-capture.controller';
import { SmsCaptureService } from './sms-capture.service';
import { DeviceTokenService } from './device-token.service';
import { DeviceTokenGuard } from './device-token.guard';
import { TransactionService } from '../transaction/transaction.service';

describe('SmsCaptureController batch validation', () => {
  let app: INestApplication;
  const ingestBatch = jest.fn().mockResolvedValue([]);
  const item = { expediteur: 'A', corps: 'b', receivedAt: 1 };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [SmsCaptureController],
      providers: [
        { provide: SmsCaptureService, useValue: { ingestBatch } },
        { provide: DeviceTokenService, useValue: {} },
        { provide: TransactionService, useValue: {} },
      ],
    })
      .overrideGuard(DeviceTokenGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().device = { adminId: 1, deviceId: 'd' }; return true; } })
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('rejects a 101-item batch with 400', async () => {
    await request(app.getHttpServer()).post('/sms-capture/batch').send({ sms: Array(101).fill(item) }).expect(400);
  });
  it('rejects a missing sms with 400', async () => {
    await request(app.getHttpServer()).post('/sms-capture/batch').send({}).expect(400);
  });
  it('rejects a null item and an over-long field with 400', async () => {
    await request(app.getHttpServer()).post('/sms-capture/batch').send({ sms: [null] }).expect(400);
    await request(app.getHttpServer()).post('/sms-capture/batch').send({ sms: [{ ...item, expediteur: 'x'.repeat(151) }] }).expect(400);
  });
  it('accepts a valid batch', async () => {
    await request(app.getHttpServer()).post('/sms-capture/batch').send({ sms: [item] }).expect(201);
    expect(ingestBatch).toHaveBeenCalledWith(1, 'd', [expect.objectContaining(item)]);
  });
});
