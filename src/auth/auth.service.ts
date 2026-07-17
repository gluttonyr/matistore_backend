import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import * as bcrypt from 'bcryptjs';
import { UserMapper } from 'src/utilisateur/mappers/user.mapper';

@Injectable()
export class AuthService {
  constructor(
    private readonly utilisateurService: UtilisateurService,
    private readonly jwtService: JwtService,
    private readonly utilisateurMapper: UserMapper
  ) { }

  async validateUser(email: string, password: string) {
    const user = await this.utilisateurService.findByEmail(email);
    if (!user) return null;
    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) return null;
    return user;
  }

  async getToken(user: { id: number; email: string }) {
    return {
      access_token: this.jwtService.sign({ sub: user.id, email: user.email }),
    };
  }
  async login(body: { email: string; password: string }) {
    const user = await this.utilisateurService.findByEmail(body.email);

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }



    const isValid = await bcrypt.compare(body.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }
    const response = user ? this.utilisateurMapper.toResponse(user) : null;

    // Pas d'expiresIn ici : on garde celui configuré globalement dans
    // AuthModule (JwtModule.registerAsync), lu depuis JWT_EXPIRATION (.env).
    // Un expiresIn explicite ici l'écraserait et ignorerait le .env.
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const decoded = this.jwtService.decode(token);

    console.log('DECODED TOKEN:', decoded);


    return {
      access_token: token,
      user: response
    };
  }

  async register(payload: { email: string; password: string }) {
    const exist = await this.utilisateurService.findByEmail(payload.email);
    if (exist) throw new BadRequestException('Email already in use');
    const user = await this.utilisateurService.create({
      email: payload.email,
      password: payload.password,
      nom: 'Utilisateur',
      prenom: 'Nouveau',
      telephone: '',
      role: 'USER',
      active: true,
    } as any);
    return this.getToken({ id: user.id, email: user.email });
  }
}
