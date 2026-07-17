import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Parametre } from './entities/parametre.entity';

@Injectable()
export class ParametreRepository extends Repository<Parametre> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Parametre, dataSource.createEntityManager());
  }

  findByCode(code: string) {
    return this.createQueryBuilder('parametre')
      .where('parametre.code = :code', { code })
      .getOne();
  }

  findOneById(id: string) {
    return this.findOne({ where: { trackingId: id } });
  }
}
