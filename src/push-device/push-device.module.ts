import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushDevice } from './entities/push-device.entity';
import { PushDeviceRepository } from './push-device.repository';
import { PushDeviceService } from './push-device.service';
import { PushDeviceController } from './push-device.controller';
import { PushDeviceMapper } from './mappers/push-device.mapper';
import { UtilisateurModule } from '../utilisateur/utilisateur.module';
import { PushNotificationService } from 'src/notifications/push-notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushDevice]), UtilisateurModule],
  providers: [PushDeviceService, PushDeviceRepository, PushDeviceMapper],
  controllers: [PushDeviceController],
  exports: [PushDeviceService, PushDeviceMapper],
})
export class PushDeviceModule {}
