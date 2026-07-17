import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiResponse } from '../common/api-response.interface';
import { GoogleOauthService } from 'src/google_oauth/google_oauth.service';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { CreateUserDto } from 'src/utilisateur/dto/create-user.dto';
import { UserMapper } from 'src/utilisateur/mappers/user.mapper';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService,private readonly googleOauthService : GoogleOauthService,private readonly utilisateurService : UtilisateurService,private readonly utilisateurMapper : UserMapper ) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }): Promise<ApiResponse> {
    const userData = await this.authService.login(body);
    
    
    return { data: userData, message: 'Connexion réussie', status: 200 };
  }

  @Post('verify-google-token')
  async verifyGoogleToken(@Body() body: { idToken: string }): Promise<ApiResponse> {
    const googleUser = await this.googleOauthService.validateGoogleToken(body.idToken);

    const user = await this.utilisateurService.findByEmail(googleUser.email);

    if (user) {
      // Compte existant : connexion normale, on renvoie le vrai profil (pas
      // le payload Google brut) pour que le mobile ait trackingId/role/etc.
      const token = await this.authService.getToken(user);
      return {
        data: {
          access_token: token.access_token,
          user: this.utilisateurMapper.toResponse(user),
          isNewUser: false,
        },
        message: 'Connexion Google réussie',
        status: 200,
      };
    }

    // Nouveau compte : on ne crée rien tout de suite — le mobile redirige
    // vers l'étape 2 (mot de passe + téléphone) qui appelle /auth/register
    // pour finaliser la création avec les infos glanées ici.
    return {
      data: {
        access_token: null,
        user: googleUser,
        isNewUser: true,
      },
      message: 'Nouvel utilisateur Google, finalisation requise',
      status: 200,
    };
  }

  @Post('register')
  async register(@Body() body: CreateUserDto): Promise<ApiResponse> {

    const user = await this.utilisateurService.create(body);
    const response = this.utilisateurMapper.toResponse(user);
    return { data: response, message: 'Utilisateur créé', status: 201 };
  }
}
