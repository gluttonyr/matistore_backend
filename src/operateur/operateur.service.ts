import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { OperateurRepository } from './operateur.repository';
import { Operateur } from './entities/operateur.entity';
import { CreateOperateurDto } from './dto/create-operateur.dto';
import { UpdateOperateurDto } from './dto/update-operateur.dto';
import { OperateurMapper } from './mappers/operateur.mapper';
import { randomUUID } from 'node:crypto';

@Injectable()
export class OperateurService implements OnModuleInit {
  constructor(
    private readonly operateurRepository: OperateurRepository,
    private readonly operateurMapper: OperateurMapper,
  ) {}

  async onModuleInit() {
    await this.seedDefaultOperateurs();
  }

  private async seedDefaultOperateurs() {
    const count = await this.operateurRepository.count();

    if (count > 0) {
      return;
    }

    await this.operateurRepository.save([
      {
        trackingId: randomUUID(),
        nom: 'TMoney',
        // Pas de numéro utilisateur dans ce format : {montant} seul, code marchand fixe.
        formatUssd: '*145*5*{montant}*1094127#',
        imageUrl: 'tmoney.webp',
        active: true,
      },
      {
        trackingId: randomUUID(),
        nom: 'Moov Money',
        // {numero} (numéro saisi par l'utilisateur) répété deux fois, comme l'exige Moov.
        formatUssd: '*155*2*2*{numero}*{numero}*{montant}#',
        imageUrl: 'flooz.webp',
        active: true,
      },
    ]);

    console.log('✅ Opérateurs par défaut créés');
  }

  async create(payload: CreateOperateurDto) {
    const existing = await this.operateurRepository.findByNom(payload.nom);
    if (existing) {
      throw new BadRequestException('Un opérateur avec ce nom existe déjà');
    }

    const entity = await this.operateurMapper.toEntity(payload);
    const operateur = this.operateurRepository.create({
      ...entity,
      active: payload.active ?? true,
    });

    return this.operateurRepository.save(operateur);
  }

  findAll() {
    return this.operateurRepository.find();
  }

  findById(id: string) {
    return this.operateurRepository.findOne({ where: { trackingId: id } });
  }

  async update(id: string, payload: UpdateOperateurDto) {
    const operateur = await this.findById(id);
    if (!operateur) {
      throw new BadRequestException('Opérateur introuvable');
    }
    Object.assign(operateur, payload);
    return this.operateurRepository.save(operateur);
  }

  async remove(id: string) {
    const operateur = await this.findById(id);
    if (!operateur) {
      throw new BadRequestException('Opérateur introuvable');
    }
    return this.operateurRepository.remove(operateur);
  }
}
