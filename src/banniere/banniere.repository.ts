import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Banniere } from './entities/banniere.entity';

@Injectable()
export class BanniereRepository extends Repository<Banniere> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Banniere, dataSource.createEntityManager());
  }

  findAllOrdered() {
    return this.find({ order: { ordre: 'ASC', createdAt: 'ASC' } });
  }

  findById(id: string) {
    return this.findOne({ where: { trackingId: id } });
  }
}
