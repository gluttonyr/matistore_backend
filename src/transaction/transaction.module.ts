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

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    MessageModule,
    DiscussionModule,
    PushDeviceModule,
    NotificationsModule,
    UtilisateurModule,
    OperateurModule,
  ],
  providers: [TransactionService, TransactionRepository, TransactionMapper],
  controllers: [TransactionController],
  exports: [TransactionService],
})
export class TransactionModule {}
