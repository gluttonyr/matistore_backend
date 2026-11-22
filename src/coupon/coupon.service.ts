import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Bookmaker } from '../bookmaker/entities/bookmaker.entity';
import { AppNotificationService } from '../app-notification/app-notification.service';
import { MessageGateway } from '../message/message.gatway';
import { Coupon, CouponCode, CouponStatus } from './coupon.entity';

const DAY_MS = 86_400_000;
const CODE_RE = /^[A-Z0-9-]{2,30}$/;

export type CreateCouponInput = {
  imageUrl?: unknown;
  codes?: unknown;
  odds?: unknown;
  note?: unknown;
  notify?: unknown;
};

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    @InjectRepository(Bookmaker) private readonly bookmakers: Repository<Bookmaker>,
    private readonly appNotificationService: AppNotificationService,
    private readonly messageGateway: MessageGateway,
  ) {}

  private async toResponse(list: Coupon[]) {
    const books = new Map((await this.bookmakers.find()).map((b) => [b.code, b]));
    return list.map((c) => ({
      id: c.id,
      number: c.number,
      imageUrl: c.imageUrl,
      odds: c.odds ?? null,
      note: c.note ?? null,
      status: c.status,
      createdAt: c.createdAt,
      codes: c.codes.map((k) => ({
        bookmaker: k.bookmaker,
        code: k.code,
        name: books.get(k.bookmaker)?.nom ?? k.bookmaker,
        logo: books.get(k.bookmaker)?.imageUrl ?? null,
        siteUrl: books.get(k.bookmaker)?.siteUrl ?? null,
      })),
    }));
  }

  /** Newest first; `before` (ISO date) pages back in time. */
  async list(before?: string, limit = 20) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const beforeDate = before ? new Date(before) : null;
    const rows = await this.coupons.find({
      where: beforeDate && !Number.isNaN(beforeDate.getTime()) ? { createdAt: LessThan(beforeDate) } : {},
      order: { createdAt: 'DESC' },
      take: take + 1,
    });
    const items = rows.slice(0, take);
    return { items: await this.toResponse(items), hasMore: rows.length > take };
  }

  /** Today's coupons (Lomé = UTC); when none yet, the last ones published. */
  async home() {
    const startOfDay = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS);
    let rows = await this.coupons.find({ where: { createdAt: MoreThanOrEqual(startOfDay) }, order: { createdAt: 'DESC' }, take: 10 });
    const today = rows.length > 0;
    if (!today) rows = await this.coupons.find({ order: { createdAt: 'DESC' }, take: 5 });
    return { today, items: await this.toResponse(rows) };
  }

  async findOne(id: string) {
    const coupon = /^[0-9a-f-]{36}$/i.test(id) ? await this.coupons.findOne({ where: { id } }) : null;
    if (!coupon) throw new NotFoundException('Coupon introuvable');
    return (await this.toResponse([coupon]))[0];
  }

  private async validate(input: CreateCouponInput) {
    const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
    if (!imageUrl) throw new BadRequestException('Ajoutez la capture du coupon.');
    try {
      const url = new URL(imageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new BadRequestException('La capture doit être une adresse HTTP ou HTTPS.');
    }
    if (!Array.isArray(input.codes)) throw new BadRequestException('Indiquez au moins un code.');
    const known = new Set((await this.bookmakers.find()).map((b) => b.code));
    const codes: CouponCode[] = [];
    for (const raw of input.codes as any[]) {
      const bookmaker = typeof raw?.bookmaker === 'string' ? raw.bookmaker.trim().toUpperCase() : '';
      const code = typeof raw?.code === 'string' ? raw.code.trim().toUpperCase().replace(/\s+/g, '') : '';
      if (!code) continue;
      if (!known.has(bookmaker)) throw new BadRequestException(`Bookmaker inconnu : ${bookmaker || '?'}`);
      if (!CODE_RE.test(code)) throw new BadRequestException(`Code ${bookmaker} invalide (lettres et chiffres, 2 à 30).`);
      if (codes.some((c) => c.bookmaker === bookmaker)) throw new BadRequestException(`Un seul code par bookmaker (${bookmaker}).`);
      codes.push({ bookmaker, code });
    }
    if (!codes.length) throw new BadRequestException('Indiquez au moins un code.');
    const odds = typeof input.odds === 'string' && input.odds.trim() ? input.odds.trim().slice(0, 12) : null;
    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 120) : null;
    return { imageUrl, codes, odds, note };
  }

  async create(input: CreateCouponInput, adminId: number) {
    const data = await this.validate(input);
    const last = await this.coupons.findOne({ where: {}, order: { number: 'DESC' } });
    const coupon = await this.coupons.save(this.coupons.create({
      ...data,
      number: (last?.number ?? 0) + 1,
      status: CouponStatus.EN_COURS,
      createdById: adminId,
    }));
    this.broadcast();
    let notified: unknown = null;
    if (input.notify !== false) {
      try {
        const codes = coupon.codes.map((c) => `${c.bookmaker} ${c.code}`).join(' · ');
        notified = await this.appNotificationService.broadcast(
          {
            title: 'Nouveau coupon du jour',
            body: `${coupon.odds ? `Cote ${coupon.odds} · ` : ''}${codes}`.slice(0, 500),
            imageUrl: coupon.imageUrl,
          },
          adminId,
          { link: `coupon:${coupon.id}`, pushData: { type: 'COUPON', couponId: coupon.id } },
        );
      } catch (error) {
        this.logger.error('Notification du coupon non envoyée', error as Error);
      }
    }
    return { coupon: (await this.toResponse([coupon]))[0], notified };
  }

  async setStatus(id: string, status: unknown) {
    if (!Object.values(CouponStatus).includes(status as CouponStatus)) throw new BadRequestException('Statut invalide');
    const coupon = await this.coupons.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon introuvable');
    coupon.status = status as CouponStatus;
    await this.coupons.save(coupon);
    this.broadcast();
    return (await this.toResponse([coupon]))[0];
  }

  async remove(id: string) {
    const result = await this.coupons.delete({ id });
    if (!result.affected) throw new NotFoundException('Coupon introuvable');
    this.broadcast();
    return { deleted: true };
  }

  private broadcast() {
    try {
      this.messageGateway.server?.emit('couponsChanged', {});
    } catch { /* socket not ready */ }
  }
}
