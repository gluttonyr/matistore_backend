import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionController } from './transaction.controller';
import { TransactionMapper } from './mappers/transaction.mapper';
import { TransactionRepository } from './transaction.repository';
import { TransactionService } from './transaction.service';
import { MessageModule } from '../message/message.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { PushDeviceModule } from '../push-device/push-device.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UtilisateurModule } from '../utilisateur/utilisateur.module';
import { OperateurModule } from '../operateur/operateur.module';
import { ServculModule } from '../servcul/servcul.module';
import { AppNotificationModule } from '../app-notification/app-notification.module';
import { AdminCaptureDevice } from './entities/admin-capture-device.entity';
import { AdminCaptureState } from './entities/admin-capture-state.entity';
import { AdminCaptureAvailabilityService } from './admin-capture-availability.service';
import { ParametreModule } from '../parametre/parametre.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, AdminCaptureDevice, AdminCaptureState]),
    MessageModule,
    DiscussionModule,
    PushDeviceModule,
    NotificationsModule,
    UtilisateurModule,
    OperateurModule,
    ServculModule,
    AppNotificationModule,
    ParametreModule,
  ],
  providers: [TransactionService, TransactionRepository, TransactionMapper, AdminCaptureAvailabilityService],
  controllers: [TransactionController],
  exports: [TransactionService],
})
export class TransactionModule {}
