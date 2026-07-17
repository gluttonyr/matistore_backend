import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscussionParticipant } from './entities/discussion-participant.entity';
import { DiscussionParticipantService } from './discussion-participant.service';
import { DiscussionParticipantController } from './discussion-participant.controller';
import { DiscussionParticipantRepository } from './discussion-participant.repository';

@Module({
  imports: [TypeOrmModule.forFeature([DiscussionParticipant])],
  providers: [DiscussionParticipantService, DiscussionParticipantRepository],
  controllers: [DiscussionParticipantController],
  exports: [DiscussionParticipantService],
})
export class DiscussionParticipantModule {}
