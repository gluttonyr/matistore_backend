import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushDeviceModule } from '../push-device/push-device.module';
import { UtilisateurModule } from '../utilisateur/utilisateur.module';
import { AppNotificationController } from './app-notification.controller';
import { AppNotificationService } from './app-notification.service';
import { AppNotification } from './entities/app-notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppNotification]), UtilisateurModule, PushDeviceModule, NotificationsModule],
  controllers: [AppNotificationController],
  providers: [AppNotificationService],
})
export class AppNotificationModule {}
