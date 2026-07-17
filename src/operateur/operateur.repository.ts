import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Operateur } from './entities/operateur.entity';

@Injectable()
export class OperateurRepository extends Repository<Operateur> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Operateur, dataSource.createEntityManager());
  }

  findByNom(nom: string) {
    return this.createQueryBuilder('operateur')
      .where('operateur.nom = :nom', { nom })
      .getOne();
  }

  findOneById(id: string) {
    return this.findOne({ where: { trackingId: id } });
  }
}
