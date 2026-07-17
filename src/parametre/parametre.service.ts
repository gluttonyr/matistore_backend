import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ParametreRepository } from './parametre.repository';
import { Parametre } from './entities/parametre.entity';
import { PARAMETRE_CODES } from './parametre.constants';

@Injectable()
export class ParametreService implements OnModuleInit {
  constructor(private readonly parametreRepository: ParametreRepository) {}

  async onModuleInit() {
    await this.seedDefaultParametres();
  }

  private async seedDefaultParametres() {
    const existing = await this.parametreRepository.findByCode(PARAMETRE_CODES.DISCUSSION_REFRESH);
    if (existing) {
      return;
    }

    await this.parametreRepository.save(
      this.parametreRepository.create({
        code: PARAMETRE_CODES.DISCUSSION_REFRESH,
        libelle: 'Nombre de jours de messages chargés par discussion',
        valeur: 2,
      }),
    );

    console.log('✅ Paramètre DISCUSSION_REFRESH créé (valeur par défaut: 2)');
  }

  create(parametre: Partial<Parametre>) {
    return this.parametreRepository.save(this.parametreRepository.create(parametre));
  }

  findAll() {
    return this.parametreRepository.find();
  }

  findByCode(code: string) {
    return this.parametreRepository.findOne({ where: { code } });
  }

  async update(code: string, payload: Partial<Parametre>) {
    const parametre = await this.findByCode(code);
    if (!parametre) {
      throw new BadRequestException('Paramètre introuvable');
    }
    Object.assign(parametre, payload);
    return this.parametreRepository.save(parametre);
  }

  async remove(code: string) {
    const parametre = await this.findByCode(code);
    if (!parametre) {
      throw new BadRequestException('Paramètre introuvable');
    }
    return this.parametreRepository.remove(parametre);
  }

  getValue(code: string) {
    return this.findByCode(code).then((p) => p?.valeur ?? null);
  }
}
