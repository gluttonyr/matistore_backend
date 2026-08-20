import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionService } from './discussion.service';
import { DiscussionController } from './discussion.controller';
import { DiscussionRepository } from './discussion.repository';
import { DiscussionParticipantModule } from 'src/discussion-participant/discussion-participant.module';
import { DiscussionParticipantService } from 'src/discussion-participant/discussion-participant.service';
import { UtilisateurModule } from 'src/utilisateur/utilisateur.module';
import { DiscussionMapper } from './mappers/discussion.mapper';
import { DiscussionWatchersService } from './discussion.watcher.service';

@Module({
  imports: [TypeOrmModule.forFeature([Discussion]),DiscussionParticipantModule,forwardRef(() => UtilisateurModule),],
  providers: [DiscussionService, DiscussionRepository,DiscussionMapper,DiscussionWatchersService],
  controllers: [DiscussionController],
  exports: [DiscussionService,DiscussionWatchersService],
})
export class DiscussionModule {}
