import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, createVerify } from 'node:crypto';

interface AppleIdentity {
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  iss: string;
  aud: string;
  exp: number;
}

@Injectable()
export class AppleOauthService {
  async validateIdentityToken(identityToken: string): Promise<AppleIdentity> {
    try {
      const [encodedHeader, encodedPayload, encodedSignature] = identityToken.split('.');
      if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('Malformed token');

      const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      const claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AppleIdentity;
      if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported token signature');

      const response = await fetch('https://appleid.apple.com/auth/keys');
      if (!response.ok) throw new Error('Could not load Apple signing keys');
      const keySet = await response.json() as { keys: Array<JsonWebKey & { kid?: string }> };
      const jwk = keySet.keys.find((key) => key.kid === header.kid);
      if (!jwk) throw new Error('Apple signing key not found');

      const publicKeyInput = {
        key: jwk,
        format: 'jwk' as const,
      } as unknown as Parameters<typeof createPublicKey>[0];
      const publicKey = createPublicKey(publicKeyInput);
      const verifier = createVerify('RSA-SHA256');
      verifier.update(`${encodedHeader}.${encodedPayload}`);
      verifier.end();
      if (!verifier.verify(publicKey, Buffer.from(encodedSignature, 'base64url'))) {
        throw new Error('Invalid Apple token signature');
      }

      const expectedAudience = process.env.APPLE_BUNDLE_ID || 'com.urbain_diligence.matistore_mobile';
      if (claims.iss !== 'https://appleid.apple.com' || claims.aud !== expectedAudience ||
          !claims.sub || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) {
        throw new Error('Invalid Apple token claims');
      }
      if (claims.email && claims.email_verified !== true && claims.email_verified !== 'true') {
        throw new Error('Apple email is not verified');
      }
      return claims;
    } catch {
      throw new UnauthorizedException('Le jeton Apple est invalide ou expiré');
    }
  }
}
