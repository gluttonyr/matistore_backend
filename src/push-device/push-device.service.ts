import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePushDeviceDto } from './dto/create-push-device.dto';
import { UpdatePushDeviceDto } from './dto/update-push-device.dto';
import { PushDevice } from './entities/push-device.entity';
import { PushDeviceRepository } from './push-device.repository';

@Injectable()
export class PushDeviceService {
  constructor(private readonly pushDeviceRepository: PushDeviceRepository) {}

  findActiveTokensForUsers(): Promise<string[]> {
    return this.pushDeviceRepository.findActiveTokensForUsers();
  }

  async create(payload: Partial<PushDevice> | CreatePushDeviceDto, userId?: number) {
    if (!userId) {
      throw new BadRequestException('L\'identifiant utilisateur est requis');
    }
    if (!payload.token) {
      throw new BadRequestException('Le token push est requis');
    }

    const existingDevice = await this.pushDeviceRepository.findByToken(payload.token as string);

    if (existingDevice) {
      // Le token existe déjà en base (même appareil, peu importe l'ancien
      // utilisateur) : on met à jour cet enregistrement au lieu d'en créer un
      // nouveau, pour ne pas violer la contrainte unique sur `token`.
      existingDevice.userId = userId;
      existingDevice.platform = (payload.platform as 'android' | 'ios') ?? existingDevice.platform;
      existingDevice.deviceId = payload.deviceId ?? existingDevice.deviceId;
      existingDevice.active = payload.active ?? true;
      return this.pushDeviceRepository.save(existingDevice);
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

  async registerForUser(userId: number, payload: Partial<PushDevice> | Omit<CreatePushDeviceDto, 'userId'>) {
    if (!payload.token) {
      throw new BadRequestException('Le token push est requis');
    }

    if (!payload.platform || !['android', 'ios'].includes(payload.platform as string)) {
      throw new BadRequestException('Plateforme invalide. Valeurs acceptées: android, ios');
    }

    const device = await this.pushDeviceRepository.findByToken(payload.token);

    if (device) {
      // Le token existe déjà en base (même appareil déjà enregistré, peu importe
      // par quel utilisateur) : on met à jour cet enregistrement au lieu d'en
      // créer un nouveau, pour ne pas violer la contrainte unique sur `token`.
      device.userId = userId;
      device.platform = payload.platform as 'android' | 'ios';
      device.deviceId = payload.deviceId ?? device.deviceId;
      device.active = payload.active ?? true;
      return this.pushDeviceRepository.save(device);
    }

    const newDevice = this.pushDeviceRepository.create({
      userId,
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

  findByUser(userId: number) {
    return this.pushDeviceRepository.findByUser(userId);
  }

  findActiveByUser(userId: number) {
    return this.pushDeviceRepository.findActiveByUser(userId);
  }

  async deactivateByToken(token: string): Promise<void> {
    const device = await this.pushDeviceRepository.findByToken(token);
    if (device && device.active) {
      device.active = false;
      await this.pushDeviceRepository.save(device);
    }
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
