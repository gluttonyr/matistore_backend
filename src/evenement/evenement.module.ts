import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evenement } from './entities/evenement.entity';
import { EvenementService } from './evenement.service';
import { EvenementController } from './evenement.controller';
import { EvenementRepository } from './evenement.repository';
import { CategorieModule } from '../categorie/categorie.module';
import { UploadModule } from 'src/uploads/UploadModule';
import { UtilisateurModule } from 'src/utilisateur/utilisateur.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { EvenementMapper } from './mappers/evenement.mapper';


@Module({
  imports: [
    TypeOrmModule.forFeature([Evenement]),
    CategorieModule,
    UploadModule,
    UtilisateurModule,
    NotificationsModule,
  ],
  providers: [EvenementService, EvenementRepository, EvenementMapper],
  controllers: [EvenementController],
  exports: [EvenementService],
})
export class EvenementModule {}
