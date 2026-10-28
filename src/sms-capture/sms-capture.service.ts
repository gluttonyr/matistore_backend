import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../transaction/transaction.service';
import { OperateurService } from '../operateur/operateur.service';
import { SmsAttributionOrigin, SmsCapture, SmsCaptureStatus } from './entities/sms-capture.entity';
import { SmsItemDto } from './dto/sms-batch.dto';
import { smsFingerprint } from './sms-fingerprint';
import { SmsListQueryDto } from './dto/sms-query.dto';
import { AssignSmsDto } from './dto/assign-sms.dto';
import { DeviceTokenService } from './device-token.service';

export interface SmsIngestResult {
  fingerprint: string;
  trackingId?: string;
  statut?: SmsCaptureStatus;
  transactionId?: string | null;
  motif?: string | null;
  error?: string;
}

const WINDOW_MS = 24 * 3600_000;
const PRE_ACTIVATION_MOTIF = 'Reçu avant l’activation de Mati-Pay sur ce téléphone : à vérifier manuellement';

const fullName = (u?: { prenom?: string; nom?: string } | null) => (u ? `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() : null);

// fingerprint and deviceId are internal and never exposed.
function toResponse(row: SmsCapture) {
  const { fingerprint, deviceId, transaction, attribuePar, ...rest } = row;
  return {
    ...rest,
    transaction: transaction && {
      trackingId: transaction.trackingId,
      statut: transaction.statut,
      montant: transaction.montant,
      numeroTelephone: transaction.numeroTelephone,
      createdAt: transaction.createdAt,
      client: fullName(transaction.user),
    },
    attribuePar: fullName(attribuePar),
  };
}

@Injectable()
export class SmsCaptureService {
  constructor(
    @InjectRepository(SmsCapture) private readonly repo: Repository<SmsCapture>,
    private readonly transactions: TransactionService,
    private readonly operateurs: OperateurService,
    private readonly tokens: DeviceTokenService,
  ) {}

  async ingestBatch(adminId: number, deviceId: string, items: SmsItemDto[]): Promise<SmsIngestResult[]> {
    const results: SmsIngestResult[] = [];
    const activatedAt = await this.tokens.activatedAt(deviceId);
    for (const item of items) {
      let fingerprint = '';
      try {
        fingerprint = smsFingerprint(item.expediteur, item.receivedAt, item.corps);
        results.push(await this.ingestOne(adminId, deviceId, item, fingerprint, activatedAt));
      } catch (e) {
        results.push({ fingerprint, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('sms')
      .leftJoinAndSelect('sms.transaction', 'tx')
      .leftJoinAndSelect('tx.user', 'client')
      .leftJoinAndSelect('sms.attribuePar', 'admin');
  }

  async list(q: SmsListQueryDto) {
    const { page, limit } = q;
    const query = this.baseQuery();
    if (q.statut) query.andWhere('sms.statut = :statut', { statut: q.statut });
    if (q.transactionId) query.andWhere('tx.trackingId = :transactionId', { transactionId: q.transactionId });
    const term = q.search?.trim();
    if (term) {
      const search = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
      const numeric = /^\d+$/.test(term);
      query.andWhere(
        `(sms.reference ILIKE :search OR sms.telephone ILIKE :search OR sms.corps ILIKE :search${numeric ? ' OR sms.montant = :montant' : ''})`,
        numeric ? { search, montant: Number(term) } : { search },
      );
    }
    const [[rows, total], sansTransaction, aRapprocher] = await Promise.all([
      query.orderBy('sms.receivedAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount(),
      this.repo.count({ where: { statut: SmsCaptureStatus.SANS_TRANSACTION } }),
      this.repo.count({ where: { statut: SmsCaptureStatus.A_RAPPROCHER } }),
    ]);
    return {
      items: rows.map(toResponse),
      total,
      counts: { SANS_TRANSACTION: sansTransaction, A_RAPPROCHER: aRapprocher },
    };
  }

  async detail(id: string) {
    const row = await this.baseQuery().andWhere('sms.trackingId = :id', { id }).getOne();
    if (!row) throw new NotFoundException('SMS introuvable');
    return toResponse(row);
  }

  async candidates(transactionId: string) {
    const t = await this.transactions.findById(transactionId);
    const rows = await this.baseQuery()
      .andWhere('sms.statut != :attribue', { attribue: SmsCaptureStatus.ATTRIBUE })
      .andWhere('sms.montant = :montant', { montant: t.montant })
      .andWhere('LOWER(sms.operateur) = LOWER(:operateur)', { operateur: t.operateur })
      .orderBy('ABS(EXTRACT(EPOCH FROM (sms.receivedAt - :txDate)))', 'ASC')
      .setParameters({ txDate: t.createdAt })
      .limit(50)
      .getMany();
    return rows.map(toResponse);
  }

  async assign(id: string, adminId: number, dto: AssignSmsDto) {
    // shortcut: the SMS row lock is held across the Servcul HTTP call (one DB connection per in-flight assign), fine for a low-volume admin route, upgrade if assigns become frequent.
    // The row lock serialises concurrent assigns of the same SMS: the loser sees ATTRIBUE and never credits.
    return this.repo.manager.transaction(async (manager) => {
      const smsRepo = manager.getRepository(SmsCapture);
      const sms = await smsRepo.findOne({ where: { trackingId: id }, lock: { mode: 'pessimistic_write' } });
      if (!sms) throw new NotFoundException('SMS introuvable');
      if (sms.statut === SmsCaptureStatus.ATTRIBUE) throw new ConflictException('SMS déjà attribué');
      const result = await this.transactions.assignSmsManually(
        dto.transactionId,
        { reference: sms.reference ?? '', corps: sms.corps, montant: sms.montant ?? 0, telephone: sms.telephone },
        adminId,
        !!dto.confirmPhoneMismatch,
      );
      Object.assign(sms, {
        statut: SmsCaptureStatus.ATTRIBUE,
        origineAttribution: SmsAttributionOrigin.MANUEL,
        attribuePar: { id: adminId },
        transaction: { trackingId: result.transactionId },
        motif: 'Attribué manuellement',
      });
      await smsRepo.save(sms);
      return result;
    });
  }

  private toResult(row: SmsCapture, fingerprint: string): SmsIngestResult {
    return {
      fingerprint,
      trackingId: row.trackingId,
      statut: row.statut,
      transactionId: row.transaction?.trackingId ?? null,
      motif: row.motif ?? null,
    };
  }

  private findByFingerprint(fingerprint: string) {
    return this.repo.findOne({ where: { fingerprint }, relations: { transaction: true } });
  }

  private async ingestOne(
    adminId: number,
    deviceId: string,
    item: SmsItemDto,
    fingerprint: string,
    activatedAt: Date | null,
  ): Promise<SmsIngestResult> {
    const existing = await this.findByFingerprint(fingerprint);
    if (existing) return this.toResult(existing, fingerprint);

    const base: Partial<SmsCapture> = {
      fingerprint,
      deviceId,
      expediteur: item.expediteur,
      corps: item.corps,
      receivedAt: new Date(item.receivedAt),
    };
    const sender = item.expediteur.trim().toLowerCase();
    const ops = await this.operateurs.findAll();
    const op = ops.find((o) => o.notificationTitleAdmin?.trim().toLowerCase() === sender);
    if (!op) return this.save(base, { statut: SmsCaptureStatus.IGNORE, motif: 'Expéditeur inconnu' });

    const fields = this.transactions.extractCaptureFields(op, item.corps);
    if (!fields) {
      return this.save({ ...base, operateur: op.nom }, {
        statut: SmsCaptureStatus.IGNORE,
        motif: 'Le texte ne correspond pas au modèle de notification configuré',
      });
    }
    const parsed = { ...base, operateur: op.nom, montant: fields.montant, telephone: fields.telephone, reference: fields.reference };

    // An SMS older than this phone's activation may match a deposit an admin already settled by hand
    // outside the app: keep it visible for manual assignment, never auto-credit it.
    if (activatedAt && base.receivedAt! < activatedAt) {
      return this.save(parsed, { statut: SmsCaptureStatus.SANS_TRANSACTION, motif: PRE_ACTIVATION_MOTIF });
    }

    const r = await this.transactions.processAdminCapture(
      {
        operateur: op.nom,
        montant: fields.montant,
        numeroTelephoneClient: fields.telephone ?? '',
        notificationBrute: item.corps,
        notificationPostedAt: item.receivedAt,
        titreNotification: item.expediteur,
      },
      adminId,
      { skipPackageCheck: true, candidateWindowMs: WINDOW_MS },
    );
    const motif = r.reason ?? r.message ?? null;

    if (r.matched) {
      return this.save(parsed, {
        statut: SmsCaptureStatus.ATTRIBUE,
        origineAttribution: SmsAttributionOrigin.AUTO_MATI_PAY,
        transaction: { trackingId: r.transactionId } as any,
        motif,
      });
    }
    if (r.duplicateReference) {
      const tx = await this.transactions.findByPaymentReference(fields.reference);
      return this.save(parsed, {
        statut: SmsCaptureStatus.ATTRIBUE,
        origineAttribution: SmsAttributionOrigin.MATISTORE,
        transaction: tx ? ({ trackingId: tx.trackingId } as any) : null,
        motif,
      });
    }
    const statut = r.transactionSelection === 'manual_reconciliation'
      ? SmsCaptureStatus.A_RAPPROCHER
      : SmsCaptureStatus.SANS_TRANSACTION;
    return this.save(parsed, { statut, motif });
  }

  private async save(base: Partial<SmsCapture>, extra: Partial<SmsCapture>): Promise<SmsIngestResult> {
    const fingerprint = base.fingerprint!;
    try {
      const row = await this.repo.save(this.repo.create({ ...base, ...extra }));
      return this.toResult(row, fingerprint);
    } catch (e: any) {
      if (e?.driverError?.code !== '23505') throw e;
      // Lost a race with a concurrent batch: report the winner's row.
      const existing = await this.findByFingerprint(fingerprint);
      if (!existing) throw e;
      return this.toResult(existing, fingerprint);
    }
  }
}
