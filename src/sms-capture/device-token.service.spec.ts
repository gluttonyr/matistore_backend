import { ForbiddenException } from '@nestjs/common';
import { DeviceTokenService } from './device-token.service';
import { createHash } from 'crypto';

describe('DeviceTokenService', () => {
  let rows: any[];
  let tick = 0;
  let user: any;
  let service: DeviceTokenService;

  beforeEach(() => {
    rows = [];
    user = { id: 1, role: 'ADMIN', active: true };
    const repo: any = {
      create: (x: any) => ({ revokedAt: null, lastUsedAt: null, createdAt: new Date(1_700_000_000_000 + ++tick), ...x }),
      save: async (x: any) => {
        if (!rows.includes(x)) rows.push(x);
        return x;
      },
      findOne: async ({ where }: any) =>
        where.tokenHash
          ? rows.find((r) => r.tokenHash === where.tokenHash) ?? null
          : [...rows].filter((r) => r.deviceId === where.deviceId).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
      update: async (where: any, patch: any) => {
        rows
          .filter((r) => r.adminId === where.adminId && r.deviceId === where.deviceId && r.revokedAt === null)
          .forEach((r) => Object.assign(r, patch));
      },
    };
    const m: any = {
      create: (_e: any, x: any) => repo.create(x),
      save: (x: any) => repo.save(x),
      delete: async (_e: any, where: any) => {
        rows = rows.filter((r) => r.deviceId !== where.deviceId);
      },
      update: async (_e: any, where: any, patch: any) => {
        rows.filter((r) => r.deviceId === where.deviceId && r.revokedAt === null).forEach((r) => Object.assign(r, patch));
      },
    };
    repo.manager = { transaction: async (cb: any) => cb(m) };
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

  it('activatedAt is the first registration, and resetActivation moves it to the new token', async () => {
    const old = await service.register(1, 'dev-1');
    const first = await service.activatedAt('dev-1');
    await service.register(1, 'dev-1');
    expect(await service.activatedAt('dev-1')).toBe(first);
    const fresh = await service.register(1, 'dev-1', true);
    const reset = await service.activatedAt('dev-1');
    expect(reset!.getTime()).toBeGreaterThan(first!.getTime());
    expect(await service.resolve(old)).toBeNull();
    expect(await service.resolve(fresh)).not.toBeNull();
  });

  it('register revokes the previous token of the same device', async () => {
    const old = await service.register(1, 'dev-1');
    const fresh = await service.register(1, 'dev-1');
    expect(await service.resolve(old)).toBeNull();
    expect(await service.resolve(fresh)).not.toBeNull();
  });

  it('register revokes the token of the same device owned by another admin', async () => {
    const old = await service.register(1, 'dev-1');
    await service.register(2, 'dev-1');
    expect(await service.resolve(old)).toBeNull();
  });

  it('register and revoke are refused for an inactive or non-ADMIN user', async () => {
    user = { id: 1, role: 'ADMIN', active: false };
    await expect(service.register(1, 'dev-1')).rejects.toThrow(ForbiddenException);
    await expect(service.revoke(1, 'dev-1')).rejects.toThrow(ForbiddenException);
    user = { id: 1, role: 'CLIENT', active: true };
    await expect(service.register(1, 'dev-1')).rejects.toThrow(ForbiddenException);
    expect(rows).toHaveLength(0);
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
