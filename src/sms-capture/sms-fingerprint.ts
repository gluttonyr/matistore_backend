import { createHash } from 'crypto';

// Must stay identical to the Kotlin side: sha256_hex(expediteur|receivedAtMs|corps).
export function smsFingerprint(expediteur: string, receivedAtMs: number, corps: string): string {
  return createHash('sha256').update(`${expediteur}|${receivedAtMs}|${corps}`).digest('hex');
}
