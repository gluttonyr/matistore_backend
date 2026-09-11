import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Message } from './entities/message.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageRepository } from './message.repository';
import { MessageGateway } from './message.gatway';
import { DiscussionModule } from 'src/discussion/discussion.module';
import { UtilisateurModule } from 'src/utilisateur/utilisateur.module';
import { ParametreModule } from 'src/parametre/parametre.module';
import { PresenceModule } from 'src/presence/presence.module';
import { MessageMapper } from './mappers/message.mapper';
import { PushDeviceModule } from 'src/push-device/push-device.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    DiscussionModule,
    UtilisateurModule,
    ParametreModule,
    PresenceModule,
    PushDeviceModule,
    NotificationsModule,
    // Nécessaire pour que MessageGateway puisse vérifier le token JWT des
    // connexions socket (suivi de présence "en ligne").
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [MessageService, MessageRepository,MessageGateway,MessageMapper],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}
