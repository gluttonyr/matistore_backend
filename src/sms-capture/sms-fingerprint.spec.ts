import { createHash } from 'crypto';
import { smsFingerprint } from './sms-fingerprint';

describe('smsFingerprint', () => {
  it('matches the vector shared with the Kotlin app', () => {
    expect(smsFingerprint('Mixx Togo', 1761055320000, 'Ref: 1')).toBe(
      '0b0fc71491cef9031a6823a3346fd5ebd605467b3838823021684b0fdac2d724',
    );
  });

  it('is the sha256 hex of expediteur|receivedAtMs|corps', () => {
    const expected = createHash('sha256').update('Mixx Togo|1761055320000|Ref: 1').digest('hex');
    expect(smsFingerprint('Mixx Togo', 1761055320000, 'Ref: 1')).toBe(expected);
  });

  it('changes when a single body character changes', () => {
    expect(smsFingerprint('Mixx Togo', 1761055320000, 'Ref: 2')).not.toBe(
      smsFingerprint('Mixx Togo', 1761055320000, 'Ref: 1'),
    );
  });
});
