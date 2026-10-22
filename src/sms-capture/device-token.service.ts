import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { SmsCaptureDeviceToken } from './entities/sms-capture-device-token.entity';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import { UserRole } from '../utilisateur/enums/user-role.enum';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectRepository(SmsCaptureDeviceToken) private readonly repo: Repository<SmsCaptureDeviceToken>,
    private readonly users: UtilisateurService,
  ) {}

  async register(adminId: number, deviceId: string): Promise<string> {
    await this.assertActiveAdmin(adminId);
    // Only the hash is persisted: a DB leak must not expose usable tokens.
    const token = randomBytes(32).toString('base64url');
    await this.repo.manager.transaction(async (m) => {
      // One active token per device, whichever admin owned the previous one.
      await m.update(SmsCaptureDeviceToken, { deviceId, revokedAt: IsNull() }, { revokedAt: new Date() });
      await m.save(m.create(SmsCaptureDeviceToken, { adminId, deviceId, tokenHash: hash(token) }));
    });
    return token;
  }

  // First time this phone was ever registered; later re-registrations don't move it.
  async activatedAt(deviceId: string): Promise<Date | null> {
    const first = await this.repo.findOne({ where: { deviceId }, order: { createdAt: 'ASC' } });
    return first?.createdAt ?? null;
  }

  async revoke(adminId: number, deviceId: string): Promise<void> {
    await this.assertActiveAdmin(adminId);
    await this.repo.update({ adminId, deviceId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async assertActiveAdmin(adminId: number): Promise<void> {
    const admin = await this.users.findUserById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN || !admin.active) {
      throw new ForbiddenException('Seul un administrateur actif peut traiter cette opération');
    }
  }

  async resolve(token: string): Promise<{ adminId: number; deviceId: string } | null> {
    const row = await this.repo.findOne({ where: { tokenHash: hash(token) } });
    if (!row || row.revokedAt) return null;
    const admin = await this.users.findUserById(row.adminId);
    if (!admin || admin.role !== UserRole.ADMIN || !admin.active) return null;
    row.lastUsedAt = new Date();
    await this.repo.save(row);
    return { adminId: row.adminId, deviceId: row.deviceId };
  }
}
