import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePushDeviceDto } from './dto/create-push-device.dto';
import { UpdatePushDeviceDto } from './dto/update-push-device.dto';
import { PushDevice } from './entities/push-device.entity';
import { PushDeviceRepository } from './push-device.repository';

@Injectable()
export class PushDeviceService {
  constructor(private readonly pushDeviceRepository: PushDeviceRepository) {}

  async create(payload: Partial<PushDevice> | CreatePushDeviceDto,userId?: string) {
    if (!userId) {
      throw new BadRequestException('L\'identifiant utilisateur est requis');
    }

    const existingToken = await this.pushDeviceRepository.findByToken(payload.token as string);
    if (existingToken && existingToken.userId !== userId) {
      existingToken.active = false;
      await this.pushDeviceRepository.save(existingToken);
    }

    const device = this.pushDeviceRepository.create({
      userId: userId,
      token: payload.token,
      platform: payload.platform,
      deviceId: payload.deviceId,
      active: payload.active ?? true,
    });

    return this.pushDeviceRepository.save(device);
  }

  async registerForUser(userId: number | string, payload: Partial<PushDevice> | Omit<CreatePushDeviceDto, 'userId'>) {
    if (!payload.token) {
      throw new BadRequestException('Le token push est requis');
    }

    if (!payload.platform || !['android', 'ios'].includes(payload.platform as string)) {
      throw new BadRequestException('Plateforme invalide. Valeurs acceptées: android, ios');
    }

    const normalizedUserId = String(userId);
    const device = await this.pushDeviceRepository.findByToken(payload.token);
    if (device) {
      if (device.userId !== normalizedUserId) {
        device.active = false;
        await this.pushDeviceRepository.save(device);
      } else {
        device.platform = payload.platform as 'android' | 'ios';
        device.deviceId = payload.deviceId ?? device.deviceId;
        device.active = payload.active ?? true;
        return this.pushDeviceRepository.save(device);
      }
    }

    const newDevice = this.pushDeviceRepository.create({
      userId: normalizedUserId,
      token: payload.token,
      platform: payload.platform as 'android' | 'ios',
      deviceId: payload.deviceId,
      active: payload.active ?? true,
    });

    return this.pushDeviceRepository.save(newDevice);
  }

  findAll() {
    return this.pushDeviceRepository.find({ relations: { user: true } as any });
  }

  findById(id: string) {
    return this.pushDeviceRepository.findById(id);
  }

  findByUser(userId: string | number) {
    const normalizedUserId = String(userId);
    return this.pushDeviceRepository.findByUser(normalizedUserId);
  }

  findActiveByUser(userId: string | number) {
    const normalizedUserId = String(userId);
    return this.pushDeviceRepository.findActiveByUser(normalizedUserId);
  }

  async update(id: string, payload: Partial<PushDevice> | UpdatePushDeviceDto) {
    const device = await this.findById(id);
    if (!device) {
      throw new BadRequestException('Appareil push introuvable');
    }

    Object.assign(device, payload);
    return this.pushDeviceRepository.save(device);
  }

  async remove(id: string) {
    const device = await this.findById(id);
    if (!device) {
      throw new BadRequestException('Appareil push introuvable');
    }
    return this.pushDeviceRepository.remove(device);
  }
}
