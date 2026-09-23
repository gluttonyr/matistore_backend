import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { PushDevice } from './entities/push-device.entity';

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
}
