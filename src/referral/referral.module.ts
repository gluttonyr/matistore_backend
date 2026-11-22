import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageModule } from '../message/message.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { AppNotificationModule } from '../app-notification/app-notification.module';
import { ReferralProfile, ReferralRound, ReferralSettings, ReferralWinner } from './entities/referral.entities';
import { ReferralAdminController, ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralProfile, ReferralSettings, ReferralRound, ReferralWinner]),
    MessageModule,
    DiscussionModule,
    AppNotificationModule,
  ],
  controllers: [ReferralController, ReferralAdminController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
