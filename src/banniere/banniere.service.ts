import { Injectable, BadRequestException } from '@nestjs/common';
import { BanniereRepository } from './banniere.repository';
import { Banniere } from './entities/banniere.entity';

@Injectable()
export class BanniereService {
  constructor(private readonly banniereRepository: BanniereRepository) {}

  async create(payload: Partial<Banniere>) {
    if (payload.ordre === undefined) {
      payload.ordre = await this.banniereRepository.count();
    }
    return this.banniereRepository.save(this.banniereRepository.create(payload));
  }

  findAll() {
    return this.banniereRepository.findAllOrdered();
  }

  findById(id: string) {
    return this.banniereRepository.findById(id);
  }

  async update(id: string, payload: Partial<Banniere>) {
    const banniere = await this.findById(id);
    if (!banniere) {
      throw new BadRequestException('Bannière introuvable');
    }
    Object.assign(banniere, payload);
    return this.banniereRepository.save(banniere);
  }

  async remove(id: string) {
    const banniere = await this.findById(id);
    if (!banniere) {
      throw new BadRequestException('Bannière introuvable');
    }
    return this.banniereRepository.remove(banniere);
  }

  async reorder(trackingIds: string[]) {
    const banners = await this.banniereRepository.findAllOrdered();
    const byId = new Map(banners.map((b) => [b.trackingId, b]));
    const toSave: Banniere[] = [];

    trackingIds.forEach((trackingId, index) => {
      const banniere = byId.get(trackingId);
      if (banniere && banniere.ordre !== index) {
        banniere.ordre = index;
        toSave.push(banniere);
      }
    });

    if (toSave.length > 0) {
      await this.banniereRepository.save(toSave);
    }
    return this.findAll();
  }
}
