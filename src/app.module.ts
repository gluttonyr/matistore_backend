import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UtilisateurModule } from './utilisateur/utilisateur.module';
import { DiscussionModule } from './discussion/discussion.module';
import { DiscussionParticipantModule } from './discussion-participant/discussion-participant.module';
import { MessageModule } from './message/message.module';
import { MessageReactionModule } from './message-reaction/message-reaction.module';
import { EvenementModule } from './evenement/evenement.module';
import { BanniereModule } from './banniere/banniere.module';
import { StickerModule } from './sticker/sticker.module';
import { ParametreModule } from './parametre/parametre.module';
import { UploadModule } from './uploads/UploadModule';
import { OperateurModule } from './operateur/operateur.module';
import { CategorieModule } from './categorie/categorie.module';
import { PresenceModule } from './presence/presence.module';
import { StatsModule } from './stats/stats.module';
import { NotificationsModule } from './notifications/notifications.module';
import { User } from './utilisateur/entities/user.entity';
import { Discussion } from './discussion/entities/discussion.entity';
import { DiscussionParticipant } from './discussion-participant/entities/discussion-participant.entity';
import { Message } from './message/entities/message.entity';
import { MessageReaction } from './message-reaction/entities/message-reaction.entity';
import { Evenement } from './evenement/entities/evenement.entity';
import { Banniere } from './banniere/entities/banniere.entity';
import { Sticker } from './sticker/entities/sticker.entity';
import { Parametre } from './parametre/entities/parametre.entity';
import { Operateur } from './operateur/entities/operateur.entity';
import { Categorie } from './categorie/entities/categorie.entity';
import { GoogleOauthModule } from './google_oauth/google_oauth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
  isGlobal: true,
}),
    TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get<string>('DB_HOST'),
    port: Number(config.get<number>('DB_PORT')),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME'),

    entities: [
      User,
      Discussion,
      DiscussionParticipant,
      Message,
      MessageReaction,
      Evenement,
      Banniere,
      Sticker,
      Parametre,
      Operateur,
      Categorie,
    ],

    synchronize: config.get('NODE_ENV') !== 'production',
    // logging: config.get('NODE_ENV') === 'development',
  }),
}),
    AuthModule,
    UtilisateurModule,
    DiscussionModule,
    DiscussionParticipantModule,
    MessageModule,
    MessageReactionModule,
    EvenementModule,
    BanniereModule,
    StickerModule,
    ParametreModule,
    OperateurModule,
    CategorieModule,
    UploadModule,
    GoogleOauthModule,
    PresenceModule,
    StatsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
