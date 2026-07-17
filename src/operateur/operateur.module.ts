import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operateur } from './entities/operateur.entity';
import { OperateurService } from './operateur.service';
import { OperateurController } from './operateur.controller';
import { OperateurRepository } from './operateur.repository';
import { OperateurMapper } from './mappers/operateur.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([Operateur])],
  providers: [OperateurService, OperateurRepository, OperateurMapper],
  controllers: [OperateurController],
  exports: [OperateurService],
})
export class OperateurModule {}
