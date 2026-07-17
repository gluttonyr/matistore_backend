import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banniere } from './entities/banniere.entity';
import { BanniereService } from './banniere.service';
import { BanniereController } from './banniere.controller';
import { BanniereRepository } from './banniere.repository';
import { UploadModule } from 'src/uploads/UploadModule';
import { BanniereMapper } from './mappers/banniere.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([Banniere]), UploadModule],
  providers: [BanniereService, BanniereRepository, BanniereMapper],
  controllers: [BanniereController],
  exports: [BanniereService],
})
export class BanniereModule {}
