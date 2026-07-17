import { Module } from '@nestjs/common';
import { GoogleOauthService } from './google_oauth.service';
import { UtilisateurModule } from 'src/utilisateur/utilisateur.module';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';

@Module({
    imports: [UtilisateurModule, AuthModule],
    providers: [GoogleOauthService],
    controllers: [],
    exports: [GoogleOauthService],
})
export class GoogleOauthModule {}
