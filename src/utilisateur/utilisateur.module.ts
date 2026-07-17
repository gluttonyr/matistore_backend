import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UtilisateurService } from './utilisateur.service';
import { UtilisateurController } from './utilisateur.controller';
import { UserRepository } from './user.repository';
import { UserMapper } from './mappers/user.mapper';
import { DiscussionModule } from 'src/discussion/discussion.module';
import { DiscussionService } from 'src/discussion/discussion.service';
import { DiscussionRepository } from 'src/discussion/discussion.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User]),forwardRef(() => DiscussionModule),],
  providers: [UtilisateurService, UserRepository,UserMapper],
  controllers: [UtilisateurController],
  exports: [UtilisateurService,UserMapper],
})
export class UtilisateurModule {}
