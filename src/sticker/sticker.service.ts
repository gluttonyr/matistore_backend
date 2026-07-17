import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { StickerRepository } from './sticker.repository';
import { Sticker } from './entities/sticker.entity';

@Injectable()
export class StickerService implements OnModuleInit {
  constructor(private readonly stickerRepository: StickerRepository) {}

  async onModuleInit() {
    await this.seedDefaultStickers();
  }

  private async seedDefaultStickers() {
    const count = await this.stickerRepository.count();
    if (count > 0) {
      return;
    }

    await this.stickerRepository.save(
      this.stickerRepository.create({
        libelle: 'Matistore',
        code: 'MATISTORE',
        image: 'matistore.png',
      }),
    );

    console.log('✅ Sticker par défaut créé (matistore.png)');
  }

  create(sticker: Partial<Sticker>) {
    return this.stickerRepository.save(this.stickerRepository.create(sticker));
  }

  findAll() {
    return this.stickerRepository.find();
  }

  findById(id: string) {
    return this.stickerRepository.findById(id);
  }

  async update(id: string, payload: Partial<Sticker>) {
    const sticker = await this.findById(id);
    if (!sticker) {
      throw new BadRequestException('Sticker introuvable');
    }
    Object.assign(sticker, payload);
    return this.stickerRepository.save(sticker);
  }

  async remove(id: string) {
    const sticker = await this.findById(id);
    if (!sticker) {
      throw new BadRequestException('Sticker introuvable');
    }
    return this.stickerRepository.remove(sticker);
  }
}
