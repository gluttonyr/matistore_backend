import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleOauthService {
  private client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  async validateGoogleToken(idToken: string) {
  console.log('========== GOOGLE AUTH DEBUG ==========');

  console.log('[GoogleAuth] Début validation du token');
  console.log('[GoogleAuth] Token reçu ?', !!idToken);
  console.log('[GoogleAuth] Longueur du token :', idToken?.length);

  if (!idToken) {
    console.error('[GoogleAuth] ❌ Aucun idToken reçu');
    throw new Error('Google ID Token manquant');
  }

  console.log(
    '[GoogleAuth] GOOGLE_CLIENT_ID configuré ?',
    !!process.env.GOOGLE_CLIENT_ID,
  );

  console.log(
    '[GoogleAuth] GOOGLE_CLIENT_ID :',
    process.env.GOOGLE_CLIENT_ID
      ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 15)}...`
      : 'UNDEFINED',
  );

  try {
    console.log('[GoogleAuth] Appel de verifyIdToken()...');

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    console.log('[GoogleAuth] ✅ Token Google valide');

    const payload = ticket.getPayload();

    if (!payload) {
      console.error('[GoogleAuth] ❌ Payload Google vide');
      throw new Error('Payload Google introuvable');
    }

    console.log('[GoogleAuth] Payload reçu :', {
      email: payload.email,
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
      sub: payload.sub,
      aud: payload.aud,
      iss: payload.iss,
      email_verified: payload.email_verified,
    });

    console.log('[GoogleAuth] Audience du token :', payload.aud);
    console.log(
      '[GoogleAuth] Audience attendue :',
      process.env.GOOGLE_CLIENT_ID,
    );

    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      console.error('[GoogleAuth] ❌ AUDIENCE INCORRECTE');
      console.error('[GoogleAuth] Token aud:', payload.aud);
      console.error('[GoogleAuth] Expected:', process.env.GOOGLE_CLIENT_ID);

      throw new Error('Google OAuth audience incorrecte');
    }

    if (!payload.email) {
      console.error('[GoogleAuth] ❌ Email Google introuvable');
      throw new Error('Google email introuvable');
    }

    console.log('[GoogleAuth] ✅ Validation terminée avec succès');

    return {
      email: payload.email,
      name: payload.name,
      googleId: payload.sub,
      picture: payload.picture,
      prenom: payload.given_name,
      nom: payload.family_name,
    };
  } catch (error: any) {
    console.error('========== GOOGLE AUTH ERROR ==========');

    console.error('[GoogleAuth] ❌ Erreur Google OAuth');

    console.error('[GoogleAuth] Message :', error?.message);

    console.error('[GoogleAuth] Nom :', error?.name);

    console.error('[GoogleAuth] Code :', error?.code);

    console.error('[GoogleAuth] Stack :', error?.stack);

    if (error?.response) {
      console.error('[GoogleAuth] Response :', error.response);
    }

    console.error('======================================');

    throw error;
  }
}
}