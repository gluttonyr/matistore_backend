import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { OperateurRepository } from './operateur.repository';
import { Operateur } from './entities/operateur.entity';
import { CreateOperateurDto } from './dto/create-operateur.dto';
import { UpdateOperateurDto } from './dto/update-operateur.dto';
import { OperateurMapper } from './mappers/operateur.mapper';
import { randomUUID } from 'node:crypto';

type OperateurSeed = {
  nom: string;
  notification_name: string;
  formatUssd: string;
  notificationPackageClient: string;
  notificationPatternClient: string;
  notificationPackageAdmin: string;
  notificationPatternAdmin: string;
};

const DEFAULT_OPERATEURS: OperateurSeed[] = [
  {
    nom: 'TMoney',
    notification_name: 'MATI STORE',
    formatUssd: '*145*5*{montant}*1094127#',
    notificationPackageClient: '',
    notificationPatternClient: 'payé\\s+(?<montant>[\\d\\s]+)\\s+FCFA[\\s\\S]*?au marchand\\s+\\d+\\s*\\((?<marchand>[^)]+)\\)[\\s\\S]*?Ref\\s*:\\s*(?<reference>\\d+)',
    notificationPackageAdmin: '',
    notificationPatternAdmin: 'Paiement de\\s+(?<montant>[\\d\\s]+)\\s+FCFA(?: effectué par\\s+(?<telephone>\\d+))?[\\s\\S]*?Ref\\s*:\\s*(?<reference>\\d+)',
  },
  {
    nom: 'Flooz',
    notification_name: 'NATI STORE NATI STORE',
    formatUssd: '*155*2*2*{numero}*{numero}*{montant}#',
    notificationPackageClient: '',
    notificationPatternClient: 'Paiement effectu[eé] avec succ[eè]s[\\s\\S]*?Montant\\s*:\\s*(?<montant>[\\d\\s]+(?:[,.]\\d{2})?)\\s*FCFA[\\s\\S]*?Nom du marchand\\s*:\\s*(?<marchand>[\\s\\S]*?)(?=\\s+Num[eé]ro marchand\\s*:)[\\s\\S]*?Txn ID\\s*:\\s*(?<reference>\\d+)',
    notificationPackageAdmin: '',
    notificationPatternAdmin: '(?=[\\s\\S]*?Montant\\s*:\\s*(?<montant>[\\d\\s,.]+)\\s*FCFA)(?=[\\s\\S]*?Numero du client\\s*:\\s*(?<telephone>\\d+))?(?=[\\s\\S]*?Txn ID\\s*:\\s*(?<reference>\\d+))',
  },
];

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
    const defaultImages: Record<string, string> = { TMoney: 'tmoney.webp', Flooz: 'flooz.webp' };
    for (const seed of DEFAULT_OPERATEURS) {
      const existing = await this.operateurRepository.findByNom(seed.nom);
      if (!existing) {
        await this.operateurRepository.save({
          trackingId: randomUUID(),
          ...seed,
          imageUrl: defaultImages[seed.nom],
          active: true,
        });
        continue;
      }

      // Synchronise les modèles techniques sans écraser l'image ni l'activation admin.
      Object.assign(existing, {
        ...seed,
        notificationPackageClient: seed.notificationPackageClient || existing.notificationPackageClient || '',
        notificationPackageAdmin: seed.notificationPackageAdmin || existing.notificationPackageAdmin || '',
      });
      await this.operateurRepository.save(existing);
    }
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

  findByNom(nom: string) {
    return this.operateurRepository.findByNom(nom);
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
