import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { UtilisateurModule } from 'src/utilisateur/utilisateur.module';
import { DiscussionModule } from 'src/discussion/discussion.module';
import { MessageModule } from 'src/message/message.module';
import { PresenceModule } from 'src/presence/presence.module';

@Module({
  imports: [UtilisateurModule, DiscussionModule, MessageModule, PresenceModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
