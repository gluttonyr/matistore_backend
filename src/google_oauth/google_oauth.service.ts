import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleOauthService {
  private client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  async validateGoogleToken(idToken: string) {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new Error('Google email introuvable');
    }

    return {
      email: payload.email,
      name: payload.name,
      googleId: payload.sub,
      picture: payload.picture,
      prenom: payload.given_name,   // "Roland"
      nom: payload.family_name
    }
  }
}