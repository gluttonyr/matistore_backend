import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { PushDevice } from './entities/push-device.entity';
import { UserRole } from '../utilisateur/enums/user-role.enum';

@Injectable()
export class PushDeviceRepository extends Repository<PushDevice> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(PushDevice, dataSource.createEntityManager());
  }

  findById(id: string) {
    return this.findOne({ where: { id }, relations: { user: true } as any });
  }

  findByToken(token: string) {
    return this.findOne({ where: { token }, relations: { user: true } as any });
  }

  findByUser(userId: number) {
    return this.find({
      where: { userId },
      relations: { user: true } as any,
      order: { createdAt: 'DESC' },
    });
  }

  findActiveByUser(userId: number) {
    return this.find({
      where: { userId, active: true },
      relations: { user: true } as any,
    });
  }

  async findActiveTokensForUsers(): Promise<string[]> {
    const rows = await this.createQueryBuilder('device')
      .innerJoin('device.user', 'user')
      .select('device.token', 'token')
      .where('device.active = :deviceActive', { deviceActive: true })
      .andWhere('user.active = :userActive', { userActive: true })
      .andWhere('user.role = :role', { role: UserRole.USER })
      .getRawMany<{ token: string }>();
    return rows.map(({ token }) => token);
  }
}
