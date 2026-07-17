import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UtilisateurModule } from '../utilisateur/utilisateur.module';
import { UserMapper } from 'src/utilisateur/mappers/user.mapper';
import { GoogleOauthService } from 'src/google_oauth/google_oauth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PassportModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET is missing in .env');
        }

        const expiration = config.get('JWT_EXPIRATION');

        console.log('JWT_EXPIRATION =', expiration);

        return {
          secret,
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRATION') as any,
          },
        };
      },
    }),

    UtilisateurModule,
  ],

  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    UserMapper,
    GoogleOauthService,
  ],

  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule { }