import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Sticker } from './entities/sticker.entity';

@Injectable()
export class StickerRepository extends Repository<Sticker> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(Sticker, dataSource.createEntityManager());
  }

  findByCode(code: string) {
    return this.createQueryBuilder('sticker')
      .where('sticker.code = :code', { code })
      .getOne();
  }

  findById(id: string) {
    return this.findOne({ where: { trackingId: id } });
  }
}
