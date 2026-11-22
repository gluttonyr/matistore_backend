import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../utilisateur/entities/user.entity';
import { UserRole } from '../utilisateur/enums/user-role.enum';
import { MessageService } from '../message/message.service';
import { MessageType } from '../message/entities/message.entity';
import { MessageGateway } from '../message/message.gatway';
import { DiscussionService } from '../discussion/discussion.service';
import { AppNotificationService } from '../app-notification/app-notification.service';
import {
  ReferralPrize,
  ReferralProfile,
  ReferralRound,
  ReferralRoundStatus,
  ReferralSettings,
  ReferralWinner,
} from './entities/referral.entities';
import {
  DEFAULT_REFERRAL_SETTINGS,
  ReferralSettingsInput,
  computeRoundEnd,
  generateReferralCode,
  missingForWinners,
  nextRoundStart,
  normalizeReferralCode,
  prizeLabel,
  validateSettingsInput,
} from './referral.rules';

const TICK_MS = 30_000;
const RANKING_CACHE_MS = 3_000;
const MAX_RANKING_ROWS = 1000;

export type RankingRow = {
  userId: number;
  trackingId: string;
  prenom: string;
  nom: string;
  image: string | null;
  validated: number;
  reachedAt: Date;
};

type RoundRules = Pick<ReferralRound, 'startAt' | 'endAt' | 'depositsRequired' | 'minAmount'>;

// A deposit's moment: when it was validated (older rows may lack it).
const DEPOSIT_AT = 'COALESCE(t."dateValidation", t.updated_at)';

@Injectable()
export class ReferralService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  private rankingCache = new Map<number, { at: number; rows: RankingRow[] }>();

  constructor(
    @InjectRepository(ReferralProfile) private readonly profiles: Repository<ReferralProfile>,
    @InjectRepository(ReferralSettings) private readonly settingsRepo: Repository<ReferralSettings>,
    @InjectRepository(ReferralRound) private readonly rounds: Repository<ReferralRound>,
    @InjectRepository(ReferralWinner) private readonly winners: Repository<ReferralWinner>,
    private readonly dataSource: DataSource,
    private readonly messageService: MessageService,
    private readonly messageGateway: MessageGateway,
    private readonly discussionService: DiscussionService,
    private readonly appNotificationService: AppNotificationService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    setTimeout(() => void this.tick(), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ───────────────────────── Rounds ─────────────────────────

  async getSettings(): Promise<ReferralSettings> {
    const existing = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.settingsRepo.save(this.settingsRepo.create({ id: 1, ...DEFAULT_REFERRAL_SETTINGS }));
  }

  getActiveRound(): Promise<ReferralRound | null> {
    return this.rounds.findOne({ where: { status: ReferralRoundStatus.ACTIVE }, order: { id: 'DESC' } });
  }

  /** Ends the round whose time is up, then starts the next one while the tournament is on. */
  async tick(now = new Date()): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const settings = await this.getSettings();
      let round = await this.getActiveRound();
      let previousEnd: Date | null = null;
      if (round && round.endAt.getTime() <= now.getTime()) {
        await this.finishRound(round);
        previousEnd = round.endAt;
        round = null;
      }
      if (!round && settings.active && settings.prizes.length >= settings.winnersCount) {
        await this.startRound(settings, nextRoundStart(previousEnd, settings.durationDays, now));
      }
    } catch (error) {
      this.logger.error('Échec du cycle du tournoi de parrainage', error as Error);
    } finally {
      this.ticking = false;
    }
  }

  private async startRound(settings: ReferralSettings, startAt: Date): Promise<ReferralRound> {
    const last = await this.rounds.findOne({ where: {}, order: { number: 'DESC' } });
    const round = await this.rounds.save(this.rounds.create({
      number: (last?.number ?? 0) + 1,
      status: ReferralRoundStatus.ACTIVE,
      startAt,
      endAt: computeRoundEnd(startAt, settings.durationDays),
      durationDays: settings.durationDays,
      winnersCount: settings.winnersCount,
      depositsRequired: settings.depositsRequired,
      minAmount: settings.minAmount,
      prizes: settings.prizes,
    }));
    this.logger.log(`🏁 Tour de parrainage n°${round.number} lancé (fin ${round.endAt.toISOString()})`);
    this.broadcast('referralRoundChanged', { number: round.number });
    return round;
  }

  private async finishRound(round: ReferralRound): Promise<void> {
    // Claim the round first so a second tick never pays it twice.
    const claimed = await this.rounds.update(
      { id: round.id, status: ReferralRoundStatus.ACTIVE },
      { status: ReferralRoundStatus.FINISHED, finishedAt: new Date() },
    );
    if (!claimed.affected) return;
    const ranking = await this.computeRanking(round, MAX_RANKING_ROWS);
    const top = ranking.slice(0, round.winnersCount);
    const saved: ReferralWinner[] = [];
    for (const [index, row] of top.entries()) {
      const prize = round.prizes.find((p) => p.rank === index + 1) ?? null;
      saved.push(await this.winners.save(this.winners.create({
        round: { id: round.id } as ReferralRound,
        user: { id: row.userId } as User,
        rank: index + 1,
        validatedCount: row.validated,
        prize,
      })));
    }
    this.rankingCache.delete(round.id);
    this.logger.log(`🏆 Tour de parrainage n°${round.number} terminé : ${saved.length} gagnant(s)`);
    this.broadcast('referralRoundChanged', { number: round.number, finished: true });
    for (const [index, row] of top.entries()) {
      const prize = saved[index]?.prize;
      void this.notifyUser(
        row.userId,
        'Vous avez gagné le tournoi de parrainage 🏆',
        `Félicitations ${row.prenom} ! Vous terminez ${index + 1}${index === 0 ? 'er' : 'e'} du tournoi de parrainage n°${round.number} `
        + `avec ${row.validated} parrainage${row.validated > 1 ? 's' : ''} validé${row.validated > 1 ? 's' : ''}. `
        + `Vous gagnez : ${prizeLabel(prize)}. Vous serez bientôt récompensé.`,
      );
    }
  }

  private async cancelActiveRound(): Promise<void> {
    const round = await this.getActiveRound();
    if (!round) return;
    await this.rounds.update({ id: round.id, status: ReferralRoundStatus.ACTIVE }, { status: ReferralRoundStatus.CANCELLED, finishedAt: new Date() });
    this.rankingCache.delete(round.id);
    this.logger.log(`⛔ Tour de parrainage n°${round.number} annulé`);
    this.broadcast('referralRoundChanged', { number: round.number, cancelled: true });
  }

  // ───────────────────────── Ranking ─────────────────────────

  /**
   * A filleul counts for his CURRENT parrain once he has made `depositsRequired` validated deposits
   * of at least `minAmount` during the round, counting only deposits made since he chose that parrain.
   * Changing parrain therefore takes the referral away from the old one at once.
   * Ties: whoever reached the score first.
   */
  async computeRanking(round: RoundRules & { id?: number }, limit = MAX_RANKING_ROWS): Promise<RankingRow[]> {
    const cached = round.id ? this.rankingCache.get(round.id) : undefined;
    if (cached && Date.now() - cached.at < RANKING_CACHE_MS) return cached.rows.slice(0, limit);
    const rows: any[] = await this.dataSource.query(
      `WITH dep AS (
         SELECT t.user_id AS filleul_id, rp.parrain_id, ${DEPOSIT_AT} AS at,
                ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY ${DEPOSIT_AT}, t."trackingId") AS n
         FROM transactions t
         JOIN referral_profiles rp ON rp.user_id = t.user_id
         WHERE t.type = 'DEPOT' AND t.statut = 'VALIDEE' AND t.montant >= $1
           AND rp.parrain_id IS NOT NULL AND rp.parrain_id <> rp.user_id
           AND ${DEPOSIT_AT} >= GREATEST($2::timestamp, rp.parrain_since)
           AND ${DEPOSIT_AT} < $3::timestamp
       ), q AS (
         SELECT filleul_id, parrain_id, at AS qualified_at FROM dep WHERE n = $4
       )
       SELECT q.parrain_id AS "userId", COUNT(*)::int AS validated, MAX(q.qualified_at) AS "reachedAt",
              u."trackingId" AS "trackingId", u.prenom, u.nom, u.image
       FROM q
       JOIN referral_profiles p ON p.user_id = q.parrain_id AND p.code IS NOT NULL
       JOIN users u ON u.id = q.parrain_id AND u.active = true
       GROUP BY q.parrain_id, u."trackingId", u.prenom, u.nom, u.image
       ORDER BY validated DESC, "reachedAt" ASC, q.parrain_id ASC
       LIMIT ${MAX_RANKING_ROWS}`,
      [round.minAmount, round.startAt, round.endAt, round.depositsRequired],
    );
    const mapped: RankingRow[] = rows.map((r) => ({
      userId: Number(r.userId),
      trackingId: r.trackingId,
      prenom: r.prenom ?? '',
      nom: r.nom ?? '',
      image: r.image ?? null,
      validated: Number(r.validated),
      reachedAt: new Date(r.reachedAt),
    }));
    if (round.id) this.rankingCache.set(round.id, { at: Date.now(), rows: mapped });
    return mapped.slice(0, limit);
  }

  // ───────────────────────── Client ─────────────────────────

  private async profileOf(userId: number): Promise<ReferralProfile> {
    const existing = await this.profiles.findOne({ where: { userId } });
    if (existing) return existing;
    return this.profiles.save(this.profiles.create({ userId, promptSeen: false }));
  }

  private async hasValidatedDeposit(userId: number): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM transactions t WHERE t.user_id = $1 AND t.type = 'DEPOT' AND t.statut = 'VALIDEE' LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  }

  async getMe(userId: number) {
    const profile = await this.profileOf(userId);
    const round = await this.getActiveRound();
    const parrain = profile.parrainId
      ? await this.dataSource.getRepository(User).findOne({ where: { id: profile.parrainId }, select: { id: true, prenom: true, nom: true } })
      : null;
    const filleuls: any[] = await this.dataSource.query(
      `SELECT u."trackingId" AS "trackingId", u.prenom, u.nom, u.image, rp.parrain_since AS "since",
              ${round
                ? `(SELECT COUNT(*) FROM transactions t WHERE t.user_id = rp.user_id AND t.type = 'DEPOT' AND t.statut = 'VALIDEE'
                    AND t.montant >= $2 AND ${DEPOSIT_AT} >= GREATEST($3::timestamp, rp.parrain_since) AND ${DEPOSIT_AT} < $4::timestamp)::int`
                : '0'} AS deposits
       FROM referral_profiles rp JOIN users u ON u.id = rp.user_id
       WHERE rp.parrain_id = $1
       ORDER BY rp.parrain_since DESC NULLS LAST
       LIMIT 300`,
      round ? [userId, round.minAmount, round.startAt, round.endAt] : [userId],
    );
    const required = round?.depositsRequired ?? Infinity;
    const list = filleuls.map((f) => ({
      trackingId: f.trackingId,
      name: `${f.prenom ?? ''} ${f.nom ?? ''}`.trim(),
      image: f.image ?? null,
      since: f.since,
      validated: Number(f.deposits) >= required,
    }));
    return {
      code: profile.code ?? null,
      canGetCode: !profile.code && await this.hasValidatedDeposit(userId),
      parrain: parrain ? { name: `${parrain.prenom ?? ''} ${parrain.nom ?? ''}`.trim(), image: parrain.image ?? null } : null,
      promptSeen: profile.promptSeen,
      totalFilleuls: list.length,
      validatedThisRound: list.filter((f) => f.validated).length,
      filleuls: list,
    };
  }

  async createCode(userId: number) {
    const profile = await this.profileOf(userId);
    if (profile.code) return { code: profile.code };
    if (!await this.hasValidatedDeposit(userId)) {
      throw new BadRequestException('Faites un premier dépôt pour obtenir votre code de parrainage.');
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateReferralCode();
      const taken = await this.profiles.findOne({ where: { code } });
      if (taken) continue;
      const result = await this.profiles
        .createQueryBuilder()
        .update()
        .set({ code, codeCreatedAt: new Date() })
        .where('user_id = :userId AND code IS NULL', { userId })
        .execute();
      if (result.affected) return { code };
      const fresh = await this.profiles.findOne({ where: { userId } });
      if (fresh?.code) return { code: fresh.code };
    }
    throw new BadRequestException('Impossible de créer le code pour le moment. Réessayez.');
  }

  async lookupCode(rawCode: unknown, userId: number) {
    const code = normalizeReferralCode(rawCode);
    const owner = code ? await this.profiles.findOne({ where: { code }, relations: { user: true } }) : null;
    if (!owner || !owner.user?.active) throw new NotFoundException('Ce code de parrainage n’existe pas.');
    if (owner.userId === userId) throw new BadRequestException('Vous ne pouvez pas utiliser votre propre code.');
    return { code, name: `${owner.user.prenom ?? ''} ${owner.user.nom ?? ''}`.trim(), image: owner.user.image ?? null };
  }

  async setParrain(userId: number, rawCode: unknown) {
    const { code, name, image } = await this.lookupCode(rawCode, userId);
    const owner = await this.profiles.findOneOrFail({ where: { code } });
    const profile = await this.profileOf(userId);
    if (profile.parrainId === owner.userId) {
      if (!profile.promptSeen) await this.profiles.update({ userId }, { promptSeen: true });
      return { parrain: { name, image }, unchanged: true };
    }
    await this.profiles.update({ userId }, { parrainId: owner.userId, parrainSince: new Date(), promptSeen: true });
    // The old parrain loses this referral at once: refresh everyone's ranking.
    const round = await this.getActiveRound();
    if (round) this.rankingCache.delete(round.id);
    this.broadcast('referralRankingChanged', {});
    return { parrain: { name, image }, unchanged: false };
  }

  async markPromptSeen(userId: number) {
    await this.profileOf(userId);
    await this.profiles.update({ userId }, { promptSeen: true });
    return { promptSeen: true };
  }

  private resolvePrizes(prizes: ReferralPrize[]) {
    return prizes.map((p) => ({ ...p, labelText: prizeLabel(p) }));
  }

  async getTournament(userId: number) {
    const round = await this.getActiveRound();
    const settings = await this.getSettings();
    let current: any = null;
    if (round) {
      const ranking = await this.computeRanking(round);
      const index = ranking.findIndex((r) => r.userId === userId);
      const mine = index >= 0 ? ranking[index] : null;
      const profile = await this.profiles.findOne({ where: { userId } });
      current = {
        number: round.number,
        startAt: round.startAt,
        endAt: round.endAt,
        winnersCount: round.winnersCount,
        prizes: this.resolvePrizes(round.prizes),
        rules: { depositsRequired: round.depositsRequired, minAmount: round.minAmount },
        ranking: ranking.map((r, i) => ({
          rank: i + 1,
          trackingId: r.trackingId,
          name: `${r.prenom} ${r.nom}`.trim(),
          image: r.image,
          validated: r.validated,
          isMe: r.userId === userId,
        })),
        me: {
          rank: index >= 0 ? index + 1 : null,
          validated: mine?.validated ?? 0,
          hasCode: !!profile?.code,
          missingForWinners: missingForWinners(mine?.validated ?? 0, index >= 0 ? index + 1 : null, ranking.map((r) => r.validated), round.winnersCount),
        },
      };
    }
    return { active: settings.active, round: current, lastResults: await this.lastResults(userId) };
  }

  private async lastResults(userId: number) {
    const round = await this.rounds.findOne({ where: { status: ReferralRoundStatus.FINISHED }, order: { id: 'DESC' } });
    if (!round) return null;
    const winners = await this.winners.find({ where: { round: { id: round.id } }, relations: { user: true }, order: { rank: 'ASC' } });
    const mine = winners.find((w) => w.user?.id === userId);
    return {
      number: round.number,
      startAt: round.startAt,
      endAt: round.endAt,
      winners: winners.map((w) => ({
        rank: w.rank,
        name: `${w.user?.prenom ?? ''} ${w.user?.nom ?? ''}`.trim(),
        image: w.user?.image ?? null,
        validated: w.validatedCount,
        prize: w.prize ? { ...w.prize, labelText: prizeLabel(w.prize) } : null,
        isMe: w.user?.id === userId,
      })),
      myRank: mine?.rank ?? null,
      myRewarded: mine?.rewarded ?? false,
    };
  }

  // ───────────────────────── Admin ─────────────────────────

  async getAdminOverview() {
    const settings = await this.getSettings();
    const round = await this.getActiveRound();
    return {
      settings: {
        active: settings.active,
        durationDays: settings.durationDays,
        winnersCount: settings.winnersCount,
        depositsRequired: settings.depositsRequired,
        minAmount: settings.minAmount,
        prizes: settings.prizes,
      },
      currentRound: round ? {
        number: round.number, startAt: round.startAt, endAt: round.endAt,
        winnersCount: round.winnersCount, depositsRequired: round.depositsRequired, minAmount: round.minAmount,
        prizes: this.resolvePrizes(round.prizes),
      } : null,
    };
  }

  async updateSettings(input: ReferralSettingsInput) {
    const settings = await this.getSettings();
    const next = validateSettingsInput(input, settings);
    const wasActive = settings.active;
    Object.assign(settings, next);
    await this.settingsRepo.save(settings);
    if (wasActive && !next.active) {
      // Turning the tournament off cancels the running round: no winners.
      await this.cancelActiveRound();
    } else if (next.active && !await this.getActiveRound()) {
      // Switched on: the first round starts now (a concurrent tick is stopped by the unique round number).
      try {
        await this.startRound(settings, new Date());
      } catch (error) {
        if (!await this.getActiveRound()) throw error;
      }
    }
    return this.getAdminOverview();
  }

  async listRounds(limit = 20) {
    const rounds = await this.rounds.find({ order: { id: 'DESC' }, take: Math.min(Math.max(limit, 1), 50) });
    const result: any[] = [];
    for (const round of rounds) {
      const winners = round.status === ReferralRoundStatus.FINISHED
        ? await this.winners.find({ where: { round: { id: round.id } }, relations: { user: true }, order: { rank: 'ASC' } })
        : [];
      const winnerRows: any[] = [];
      for (const w of winners) {
        let discussionId: string | null = null;
        try {
          discussionId = (await this.discussionService.getDepotRetraitDiscussion(w.user.id)).trackingId;
        } catch { /* user without a deposit chat */ }
        winnerRows.push({
          id: w.id,
          rank: w.rank,
          name: `${w.user?.prenom ?? ''} ${w.user?.nom ?? ''}`.trim(),
          image: w.user?.image ?? null,
          userTrackingId: w.user?.trackingId,
          discussionId,
          validated: w.validatedCount,
          prize: w.prize ? { ...w.prize, labelText: prizeLabel(w.prize) } : null,
          rewarded: w.rewarded,
          rewardedAt: w.rewardedAt ?? null,
        });
      }
      result.push({
        id: round.id,
        number: round.number,
        status: round.status,
        startAt: round.startAt,
        endAt: round.endAt,
        winners: winnerRows,
        rewardedCount: winnerRows.filter((w) => w.rewarded).length,
      });
    }
    return result;
  }

  async setRewarded(winnerId: number, rewarded: boolean, adminId: number) {
    const winner = await this.winners.findOne({ where: { id: winnerId }, relations: { user: true, round: true } });
    if (!winner) throw new NotFoundException('Gagnant introuvable');
    if (winner.rewarded === rewarded) return { id: winner.id, rewarded };
    await this.winners.update({ id: winnerId }, {
      rewarded,
      rewardedAt: rewarded ? new Date() : null,
      rewardedById: rewarded ? adminId : null,
    });
    if (rewarded) {
      void this.notifyUser(
        winner.user.id,
        'Récompense remise 🎁',
        `Votre récompense du tournoi de parrainage n°${winner.round.number} (${prizeLabel(winner.prize)}) vous a été remise. Merci et bonne chance pour le prochain tour !`,
        adminId,
      );
    }
    return { id: winner.id, rewarded };
  }

  async stats() {
    const round = await this.getActiveRound();
    if (!round) return { round: null };
    const ranking = await this.computeRanking(round);
    const [{ joined }]: any[] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS joined FROM referral_profiles WHERE parrain_id IS NOT NULL AND parrain_since >= $1`,
      [round.startAt],
    );
    const [{ amount }]: any[] = await this.dataSource.query(
      `SELECT COALESCE(SUM(t.montant), 0)::bigint AS amount
       FROM transactions t JOIN referral_profiles rp ON rp.user_id = t.user_id
       WHERE rp.parrain_id IS NOT NULL AND t.type = 'DEPOT' AND t.statut = 'VALIDEE'
         AND ${DEPOSIT_AT} >= GREATEST($1::timestamp, rp.parrain_since) AND ${DEPOSIT_AT} < $2::timestamp`,
      [round.startAt, round.endAt],
    );
    const daily: any[] = await this.dataSource.query(
      `WITH dep AS (
         SELECT t.user_id, ${DEPOSIT_AT} AS at,
                ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY ${DEPOSIT_AT}, t."trackingId") AS n
         FROM transactions t JOIN referral_profiles rp ON rp.user_id = t.user_id
         WHERE t.type = 'DEPOT' AND t.statut = 'VALIDEE' AND t.montant >= $1
           AND rp.parrain_id IS NOT NULL
           AND ${DEPOSIT_AT} >= GREATEST($2::timestamp, rp.parrain_since) AND ${DEPOSIT_AT} < $3::timestamp
       )
       SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS validated
       FROM dep WHERE n = $4 GROUP BY 1 ORDER BY 1`,
      [round.minAmount, round.startAt, round.endAt, round.depositsRequired],
    );
    return {
      round: { number: round.number, startAt: round.startAt, endAt: round.endAt },
      participants: ranking.length,
      validated: ranking.reduce((sum, r) => sum + r.validated, 0),
      filleulsJoined: Number(joined),
      depositedAmount: Number(amount),
      daily: daily.map((d) => ({ day: d.day, validated: Number(d.validated) })),
      top: ranking.slice(0, 10).map((r, i) => ({ rank: i + 1, name: `${r.prenom} ${r.nom}`.trim(), validated: r.validated })),
    };
  }

  // ───────────────────────── Notifications ─────────────────────────

  /** Message in the user's deposit / withdrawal chat (it sends the push) + in-app notification. */
  private async notifyUser(userId: number, title: string, body: string, senderAdminId?: number) {
    try {
      await this.appNotificationService.createForUser(userId, title, body);
    } catch (error) {
      this.logger.warn(`Notification in-app du parrainage non créée (${userId}) : ${(error as Error).message}`);
    }
    try {
      const users = this.dataSource.getRepository(User);
      const sender = (senderAdminId ? await users.findOne({ where: { id: senderAdminId } }) : null)
        ?? await users.findOne({ where: { role: UserRole.ADMIN, active: true }, order: { id: 'ASC' } });
      if (!sender) return;
      const discussion = await this.discussionService.getDepotRetraitDiscussion(userId);
      await this.messageService.create({
        discussion: { trackingId: discussion.trackingId } as any,
        sender: { trackingId: sender.trackingId } as any,
        type: MessageType.TEXT,
        contenu: body,
      });
    } catch (error) {
      this.logger.warn(`Message de parrainage non envoyé (${userId}) : ${(error as Error).message}`);
    }
  }

  private broadcast(event: string, payload: unknown) {
    try {
      this.messageGateway.server?.emit(event, payload);
    } catch { /* socket not ready */ }
  }
}
