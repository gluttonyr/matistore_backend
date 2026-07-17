import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Evenement } from './entities/evenement.entity';

@Injectable()
export class EvenementRepository extends Repository<Evenement> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Evenement, dataSource.createEntityManager());
  }

  findAllWithCreator() {
    return this.createQueryBuilder('evenement')
      .leftJoinAndSelect('evenement.createdBy', 'creator')
      .getMany();
  }

  findById(id: string) {
    return this.findOne({ where: { trackingId: id }, relations: { user: true } });
  }
}
