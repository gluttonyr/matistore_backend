import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parametre } from './entities/parametre.entity';
import { ParametreService } from './parametre.service';
import { ParametreController } from './parametre.controller';
import { ParametreRepository } from './parametre.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Parametre])],
  providers: [ParametreService, ParametreRepository],
  controllers: [ParametreController],
  exports: [ParametreService],
})
export class ParametreModule {}
