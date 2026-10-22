import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsCapture } from './entities/sms-capture.entity';
import { SmsCaptureDeviceToken } from './entities/sms-capture-device-token.entity';
import { TransactionModule } from '../transaction/transaction.module';
import { OperateurModule } from '../operateur/operateur.module';
import { UtilisateurModule } from '../utilisateur/utilisateur.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsCapture, SmsCaptureDeviceToken]),
    TransactionModule,
    OperateurModule,
    UtilisateurModule,
  ],
})
export class SmsCaptureModule {}
