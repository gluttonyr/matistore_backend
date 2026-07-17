import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  findByEmail(email: string) {
    return this.createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();
  }

  findOneById(id: string) {
    return this.findOne({ where: { trackingId: id } });
  }

  countCreatedSince(date: Date) {
    return this.createQueryBuilder('user')
      .where('user.createdAt >= :date', { date })
      .getCount();
  }
}
