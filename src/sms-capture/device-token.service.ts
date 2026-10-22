import { Injectable } from '@nestjs/common';
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
    // Only the hash is persisted: a DB leak must not expose usable tokens.
    const token = randomBytes(32).toString('base64url');
    await this.revoke(adminId, deviceId);
    await this.repo.save(this.repo.create({ adminId, deviceId, tokenHash: hash(token) }));
    return token;
  }

  async revoke(adminId: number, deviceId: string): Promise<void> {
    await this.repo.update({ adminId, deviceId, revokedAt: IsNull() }, { revokedAt: new Date() });
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
