import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../transaction/transaction.service';
import { OperateurService } from '../operateur/operateur.service';
import { SmsAttributionOrigin, SmsCapture, SmsCaptureStatus } from './entities/sms-capture.entity';
import { SmsItemDto } from './dto/sms-batch.dto';
import { smsFingerprint } from './sms-fingerprint';

export interface SmsIngestResult {
  fingerprint: string;
  trackingId?: string;
  statut?: SmsCaptureStatus;
  transactionId?: string | null;
  motif?: string | null;
  error?: string;
}

const WINDOW_MS = 24 * 3600_000;

@Injectable()
export class SmsCaptureService {
  constructor(
    @InjectRepository(SmsCapture) private readonly repo: Repository<SmsCapture>,
    private readonly transactions: TransactionService,
    private readonly operateurs: OperateurService,
  ) {}

  async ingestBatch(adminId: number, deviceId: string, items: SmsItemDto[]): Promise<SmsIngestResult[]> {
    const results: SmsIngestResult[] = [];
    for (const item of items) {
      const fingerprint = smsFingerprint(item.expediteur, item.receivedAt, item.corps);
      try {
        results.push(await this.ingestOne(adminId, deviceId, item, fingerprint));
      } catch (e) {
        results.push({ fingerprint, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
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

  private async ingestOne(adminId: number, deviceId: string, item: SmsItemDto, fingerprint: string): Promise<SmsIngestResult> {
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
      { skipPackageCheck: true, candidateWindowMs: WINDOW_MS, includeAutoRejected: true },
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
