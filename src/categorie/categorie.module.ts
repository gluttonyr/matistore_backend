import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categorie } from './entities/categorie.entity';
import { CategorieService } from './categorie.service';
import { CategorieController } from './categorie.controller';
import { CategorieRepository } from './categorie.repository';
import { CategorieMapper } from './mappers/categorie.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([Categorie])],
  providers: [CategorieService, CategorieRepository, CategorieMapper],
  controllers: [CategorieController],
  exports: [CategorieService],
})
export class CategorieModule {}
