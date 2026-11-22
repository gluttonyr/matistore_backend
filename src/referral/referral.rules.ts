import { BadRequestException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { ReferralPrize } from './entities/referral.entities';

export const DEFAULT_REFERRAL_SETTINGS = {
  active: false,
  durationDays: 7,
  winnersCount: 5,
  depositsRequired: 3,
  minAmount: 500,
  prizes: [] as ReferralPrize[],
};

const DAY_MS = 86_400_000;

/**
 * A round ends at midnight (UTC = Lomé time) once its duration has passed:
 * started today at 15:00 for 7 days → ends at tonight's midnight + 7 days.
 * A round that starts exactly at midnight (the automatic next round) lasts exactly its duration.
 */
export function computeRoundEnd(startAt: Date, durationDays: number): Date {
  const start = startAt.getTime();
  const midnight = Math.ceil(start / DAY_MS) * DAY_MS;
  return new Date(midnight + durationDays * DAY_MS);
}

/** When the next round starts: right after the previous one, unless the server was down for longer than a round. */
export function nextRoundStart(previousEnd: Date | null, durationDays: number, now: Date): Date {
  if (!previousEnd) return now;
  return computeRoundEnd(previousEnd, durationDays).getTime() > now.getTime() ? previousEnd : now;
}

export function prizeLabel(prize?: ReferralPrize | null): string {
  if (!prize) return '';
  if (prize.type === 'LOT') return prize.label?.trim() || 'Lot';
  return `${Number(prize.amount ?? 0).toLocaleString('fr-FR')} FCFA`;
}

/** How many more validated referrals put this user in the winners (0 when already in). */
export function missingForWinners(myValidated: number, myRank: number | null, rankedCounts: number[], winnersCount: number): number {
  if (myRank !== null && myRank <= winnersCount) return 0;
  if (rankedCounts.length < winnersCount) return Math.max(1 - myValidated, 1);
  const last = rankedCounts[winnersCount - 1];
  // Ties go to whoever reached the score first, so passing needs one more.
  return Math.max(1, last - myValidated + 1);
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateReferralCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `MATI-${suffix}`;
}

export function normalizeReferralCode(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '') : '';
  if (!value) return '';
  return value.startsWith('MATI-') ? value : value.startsWith('MATI') ? `MATI-${value.slice(4)}` : `MATI-${value}`;
}

function intIn(value: unknown, min: number, max: number, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new BadRequestException(`${label} : entre ${min} et ${max}.`);
  }
  return n;
}

export type ReferralSettingsInput = {
  active?: unknown;
  durationDays?: unknown;
  winnersCount?: unknown;
  depositsRequired?: unknown;
  minAmount?: unknown;
  prizes?: unknown;
};

export function validateSettingsInput(input: ReferralSettingsInput, current: typeof DEFAULT_REFERRAL_SETTINGS) {
  const durationDays = input.durationDays === undefined ? current.durationDays : intIn(input.durationDays, 1, 90, 'Durée du tour (jours)');
  const winnersCount = input.winnersCount === undefined ? current.winnersCount : intIn(input.winnersCount, 1, 20, 'Nombre de gagnants');
  const depositsRequired = input.depositsRequired === undefined ? current.depositsRequired : intIn(input.depositsRequired, 1, 20, 'Nombre de dépôts');
  const minAmount = input.minAmount === undefined ? current.minAmount : intIn(input.minAmount, 100, 1_000_000, 'Montant minimum (FCFA)');
  const rawPrizes = input.prizes === undefined ? current.prizes : input.prizes;
  if (!Array.isArray(rawPrizes)) throw new BadRequestException('Prix invalides.');
  const prizes: ReferralPrize[] = [];
  for (let rank = 1; rank <= winnersCount; rank++) {
    const p = (rawPrizes as any[]).find((x) => Number(x?.rank) === rank) ?? rawPrizes[rank - 1];
    if (!p || (p.type !== 'MONEY' && p.type !== 'LOT')) {
      throw new BadRequestException(`Indiquez le prix de la place ${rank}.`);
    }
    if (p.type === 'MONEY') {
      prizes.push({ rank, type: 'MONEY', amount: intIn(p.amount, 1, 100_000_000, `Montant du prix ${rank}`) });
    } else {
      const label = typeof p.label === 'string' ? p.label.trim().slice(0, 80) : '';
      const imageUrl = typeof p.imageUrl === 'string' ? p.imageUrl.trim().slice(0, 255) : '';
      if (!label) throw new BadRequestException(`Donnez un nom au lot de la place ${rank}.`);
      if (!imageUrl) throw new BadRequestException(`Ajoutez la photo du lot de la place ${rank}.`);
      prizes.push({ rank, type: 'LOT', label, imageUrl });
    }
  }
  const active = input.active === undefined ? current.active : input.active === true;
  return { active, durationDays, winnersCount, depositsRequired, minAmount, prizes };
}
