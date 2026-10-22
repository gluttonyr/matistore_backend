import { DeviceTokenService } from './device-token.service';
import { createHash } from 'crypto';

describe('DeviceTokenService', () => {
  let rows: any[];
  let user: any;
  let service: DeviceTokenService;

  beforeEach(() => {
    rows = [];
    user = { id: 1, role: 'ADMIN', active: true };
    const repo: any = {
      create: (x: any) => ({ revokedAt: null, lastUsedAt: null, ...x }),
      save: async (x: any) => {
        if (!rows.includes(x)) rows.push(x);
        return x;
      },
      findOne: async ({ where }: any) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
      update: async (where: any, patch: any) => {
        rows
          .filter((r) => r.adminId === where.adminId && r.deviceId === where.deviceId && r.revokedAt === null)
          .forEach((r) => Object.assign(r, patch));
      },
    };
    const users: any = { findUserById: async () => user };
    service = new DeviceTokenService(repo, users);
  });

  it('register stores only the hash and resolve returns the admin', async () => {
    const token = await service.register(1, 'dev-1');
    expect(rows[0].tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(await service.resolve(token)).toEqual({ adminId: 1, deviceId: 'dev-1' });
    expect(rows[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it('register revokes the previous token of the same device', async () => {
    const old = await service.register(1, 'dev-1');
    const fresh = await service.register(1, 'dev-1');
    expect(await service.resolve(old)).toBeNull();
    expect(await service.resolve(fresh)).not.toBeNull();
  });

  it('resolve returns null for a revoked token', async () => {
    const token = await service.register(1, 'dev-1');
    await service.revoke(1, 'dev-1');
    expect(await service.resolve(token)).toBeNull();
    expect(await service.resolve('unknown')).toBeNull();
  });

  it('resolve returns null when the admin is no longer ADMIN or inactive', async () => {
    const token = await service.register(1, 'dev-1');
    user = { id: 1, role: 'CLIENT', active: true };
    expect(await service.resolve(token)).toBeNull();
    user = { id: 1, role: 'ADMIN', active: false };
    expect(await service.resolve(token)).toBeNull();
  });
});
