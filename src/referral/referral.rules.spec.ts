import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_REFERRAL_SETTINGS,
  computeRoundEnd,
  generateReferralCode,
  missingForWinners,
  nextRoundStart,
  normalizeReferralCode,
  prizeLabel,
  validateSettingsInput,
} from './referral.rules';

describe('referral rules', () => {
  it('ends a round started during the day at midnight after its duration', () => {
    const end = computeRoundEnd(new Date('2026-11-21T15:20:00Z'), 7);
    expect(end.toISOString()).toBe('2026-11-29T00:00:00.000Z');
  });

  it('makes a round started at midnight last exactly its duration', () => {
    const end = computeRoundEnd(new Date('2026-11-29T00:00:00Z'), 3);
    expect(end.toISOString()).toBe('2026-12-02T00:00:00.000Z');
  });

  it('chains rounds, unless the server missed more than a whole round', () => {
    const prevEnd = new Date('2026-11-29T00:00:00Z');
    expect(nextRoundStart(prevEnd, 7, new Date('2026-11-29T00:00:30Z'))).toBe(prevEnd);
    const late = new Date('2026-12-20T10:00:00Z');
    expect(nextRoundStart(prevEnd, 7, late)).toBe(late);
    expect(nextRoundStart(null, 7, late)).toBe(late);
  });

  it('labels prizes', () => {
    expect(prizeLabel({ rank: 1, type: 'MONEY', amount: 20000 })).toMatch(/^20\s?000 FCFA$/);
    expect(prizeLabel({ rank: 1, type: 'LOT', label: 'Smartphone', imageUrl: 'x.png' })).toBe('Smartphone');
  });

  it('counts what is missing to enter the winners (ties go to the first)', () => {
    expect(missingForWinners(3, 14, [12, 11, 9, 9, 6, 5], 5)).toBe(4);
    expect(missingForWinners(6, 5, [12, 11, 9, 9, 6], 5)).toBe(0);
    expect(missingForWinners(0, null, [2, 1], 5)).toBe(1);
  });

  it('generates and normalizes codes', () => {
    expect(generateReferralCode()).toMatch(/^MATI-[A-Z2-9]{4}$/);
    expect(normalizeReferralCode(' mati-4k7p ')).toBe('MATI-4K7P');
    expect(normalizeReferralCode('4k7p')).toBe('MATI-4K7P');
    expect(normalizeReferralCode('MATI4K7P')).toBe('MATI-4K7P');
  });

  it('validates the settings and their prizes', () => {
    const ok = validateSettingsInput({
      active: true, winnersCount: 2, depositsRequired: 4, minAmount: 1000,
      prizes: [{ rank: 1, type: 'LOT', label: 'Smartphone', imageUrl: 'p.png' }, { rank: 2, type: 'MONEY', amount: 5000 }],
    }, DEFAULT_REFERRAL_SETTINGS);
    expect(ok).toMatchObject({ active: true, winnersCount: 2, depositsRequired: 4, minAmount: 1000, durationDays: 7 });
    expect(ok.prizes).toHaveLength(2);
    expect(() => validateSettingsInput({ winnersCount: 1, prizes: [{ rank: 1, type: 'LOT', label: 'Sac' }] }, DEFAULT_REFERRAL_SETTINGS))
      .toThrow(BadRequestException);
    expect(() => validateSettingsInput({ winnersCount: 2, prizes: [{ rank: 1, type: 'MONEY', amount: 100 }] }, DEFAULT_REFERRAL_SETTINGS))
      .toThrow(/place 2/);
    expect(() => validateSettingsInput({ depositsRequired: 0 }, DEFAULT_REFERRAL_SETTINGS)).toThrow(BadRequestException);
  });
});
