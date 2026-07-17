import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Categorie } from './entities/categorie.entity';

@Injectable()
export class CategorieRepository extends Repository<Categorie> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Categorie, dataSource.createEntityManager());
  }

  findOneById(id: string) {
    return this.findOne({ where: { trackingId: id } });
  }
}
