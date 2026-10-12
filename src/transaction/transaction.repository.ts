import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Transaction, TransactionStatus, TransactionType, ValidationMethod } from './entities/transaction.entity';
import { User } from '../utilisateur/entities/user.entity';

@Injectable()
export class TransactionRepository extends Repository<Transaction> {
  constructor(@InjectDataSource() dataSource: DataSource) { super(Transaction, dataSource.createEntityManager()); }
  findByTrackingId(trackingId: string) { return this.findOne({ where: { trackingId }, relations: { user: true, validePar: true } }); }

  markWithdrawalDebited(trackingId: string, amount: number | null) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId, type: TransactionType.RETRAIT },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || transaction.statut !== TransactionStatus.EN_VERIFICATION) return null;
      if (amount !== null && Number.isSafeInteger(amount) && amount > 0) transaction.montant = amount;
      transaction.statut = TransactionStatus.EN_ATTENTE_ADMIN;
      transaction.creditError = null;
      return repository.save(transaction);
    });
  }

  validateManualWithdrawal(trackingId: string, adminId: number) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId, type: TransactionType.RETRAIT },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || transaction.statut !== TransactionStatus.EN_ATTENTE_ADMIN) return null;
      transaction.statut = TransactionStatus.VALIDEE;
      transaction.methodeValidation = ValidationMethod.ADMIN_MANUEL;
      transaction.creditError = null;
      transaction.dateValidation = new Date();
      transaction.validePar = { id: adminId } as User;
      return repository.save(transaction);
    });
  }
  findByUser(userId: number) { return this.find({ where: { user: { id: userId } }, relations: { user: true, validePar: true }, order: { createdAt: 'DESC' } }); }
  findByConfirmedReference(referencePaiement: string) {
    return this.findOne({ where: { referencePaiement } });
  }

  createDepositIfNoOpen(
    userId: number,
    transactionData: Partial<Transaction>,
    expiredBefore: Date,
    pausedExpirationMs = 0,
  ): Promise<{ transaction: Transaction | null; existing: Transaction | null; expired: Transaction[] }> {
    return this.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) return { transaction: null, existing: null, expired: [] };

      const repository = manager.getRepository(Transaction);
      const openStatuses = [
        TransactionStatus.EN_ATTENTE_AUTO,
        TransactionStatus.EN_VERIFICATION,
        TransactionStatus.EN_ATTENTE_PREUVE,
        TransactionStatus.EN_ATTENTE_ADMIN,
        TransactionStatus.EN_RECLAMATION,
      ];
      const openDeposits = await repository.find({
        where: {
          user: { id: userId },
          type: TransactionType.DEPOT,
          statut: In(openStatuses),
        },
        relations: { user: true },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      const expired: Transaction[] = [];
      const expiredIds = new Set<string>();
      for (const previous of openDeposits) {
        const awaitingPayment = [
          TransactionStatus.EN_ATTENTE_AUTO,
          TransactionStatus.EN_VERIFICATION,
          TransactionStatus.EN_ATTENTE_PREUVE,
        ].includes(previous.statut);
        const pausedSinceCreation = Math.max(0, pausedExpirationMs - Number(previous.capturePauseMsAtCreation || 0));
        const effectiveExpiredBefore = new Date(expiredBefore.getTime() - pausedSinceCreation);
        if (awaitingPayment && !previous.captureReconciliationRequired && !previous.referencePaiement && !previous.creditError && previous.createdAt < effectiveExpiredBefore) {
          previous.statut = TransactionStatus.REJETEE;
          previous.motifRejet = 'Aucune notification valide reçue dans la minute suivant la demande.';
          previous.dateValidation = new Date();
          const saved = await repository.save(previous);
          expired.push(saved);
          expiredIds.add(previous.trackingId);
        }
      }

      const activeDeposit = openDeposits.find((previous) => !expiredIds.has(previous.trackingId));
      if (activeDeposit) return { transaction: null, existing: activeDeposit, expired };

      const created = repository.create({
        ...transactionData,
        user: { id: userId } as User,
      });
      return { transaction: await repository.save(created), existing: null, expired };
    });
  }

  createWithdrawalIfCodeUnused(userId: number, transactionData: Partial<Transaction>) {
    return this.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) return null;
      const repository = manager.getRepository(Transaction);
      const existing = await repository.findOne({
        where: {
          user: { id: userId },
          type: TransactionType.RETRAIT,
          codeRetrait: transactionData.codeRetrait!,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) return null;
      return repository.save(repository.create({
        ...transactionData,
        user: { id: userId } as User,
      }));
    });
  }

  markDepositAsVerified(
    trackingId: string,
    referencePaiement: string,
    notificationBrute: string,
  ) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction
        || transaction.type !== TransactionType.DEPOT
        || ![TransactionStatus.EN_ATTENTE_AUTO, TransactionStatus.EN_VERIFICATION].includes(transaction.statut)) {
        return null;
      }

      transaction.referencePaiement = referencePaiement;
      transaction.notificationBrute = notificationBrute;
      transaction.statut = TransactionStatus.EN_VERIFICATION;
      return repository.save(transaction);
    });
  }

  cancelPendingDeposit(trackingId: string, userId: number) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId, user: { id: userId } },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction
        || transaction.type !== TransactionType.DEPOT
        || !!transaction.referencePaiement
        || ![
          TransactionStatus.EN_ATTENTE_AUTO,
          TransactionStatus.EN_VERIFICATION,
          TransactionStatus.EN_ATTENTE_PREUVE,
        ].includes(transaction.statut)) {
        return null;
      }

      transaction.statut = TransactionStatus.ANNULEE;
      transaction.captureReconciliationRequired = false;
      return repository.save(transaction);
    });
  }

  claimRejectedTransaction(trackingId: string, userId: number) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId, user: { id: userId } },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !transaction
        || transaction.statut !== TransactionStatus.REJETEE
        || transaction.dateTraitementReclamation
      ) return null;

      transaction.statut = TransactionStatus.EN_RECLAMATION;
      transaction.dateReclamation = new Date();
      return repository.save(transaction);
    });
  }

  resolveClaim(
    trackingId: string,
    adminId: number,
    decision: TransactionStatus.VALIDEE | TransactionStatus.REJETEE,
    motif?: string,
  ) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId, statut: TransactionStatus.EN_RECLAMATION },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction) return null;

      transaction.statut = decision;
      transaction.dateTraitementReclamation = new Date();
      transaction.dateValidation = new Date();
      transaction.validePar = { id: adminId } as any;
      transaction.creditError = null;
      if (decision === TransactionStatus.VALIDEE) {
        transaction.methodeValidation = ValidationMethod.ADMIN_MANUEL;
        transaction.motifRejet = null;
      } else {
        transaction.motifRejet = motif?.trim() || 'Réclamation examinée et refusée par MatiStore.';
      }
      return repository.save(transaction);
    });
  }

  validateAdminTransaction(
    trackingId: string,
    adminId: number,
    beforeValidation: (transaction: Transaction) => Promise<void>,
    validationMethod: ValidationMethod = ValidationMethod.ADMIN_MANUEL,
  ) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || transaction.statut !== TransactionStatus.EN_ATTENTE_ADMIN) {
        return null;
      }

      if (transaction.type === TransactionType.DEPOT) {
        await beforeValidation(transaction);
      }

      transaction.statut = TransactionStatus.VALIDEE;
      transaction.methodeValidation = validationMethod;
      transaction.creditError = null;
      transaction.dateValidation = new Date();
      transaction.validePar = { id: adminId } as any;
      return repository.save(transaction);
    });
  }

  completeAutomaticTransaction(
    trackingId: string,
    beforeValidation: (transaction: Transaction) => Promise<void>,
    validationMethod: ValidationMethod,
    allowedStatuses: TransactionStatus[],
  ) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || !allowedStatuses.includes(transaction.statut)) return null;

      await beforeValidation(transaction);
      transaction.statut = TransactionStatus.VALIDEE;
      transaction.methodeValidation = validationMethod;
      transaction.creditError = null;
      transaction.captureReconciliationRequired = false;
      transaction.dateValidation = new Date();
      return repository.save(transaction);
    });
  }

  resolveCaptureReconciliation(
    trackingId: string,
    adminId: number,
    decision: TransactionStatus.VALIDEE | TransactionStatus.REJETEE,
    motif?: string,
  ) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId, type: TransactionType.DEPOT, captureReconciliationRequired: true },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || ![
        TransactionStatus.EN_ATTENTE_AUTO,
        TransactionStatus.EN_VERIFICATION,
        TransactionStatus.EN_ATTENTE_PREUVE,
      ].includes(transaction.statut)) return null;

      transaction.statut = decision;
      transaction.captureReconciliationRequired = false;
      transaction.dateValidation = new Date();
      transaction.validePar = { id: adminId } as any;
      transaction.creditError = null;
      if (decision === TransactionStatus.VALIDEE) {
        transaction.methodeValidation = ValidationMethod.ADMIN_MANUEL;
        transaction.motifRejet = null;
      } else {
        transaction.motifRejet = motif?.trim() || 'Paiement non retrouvé après vérification manuelle.';
      }
      return repository.save(transaction);
    });
  }

  async setAutomaticTransactionError(
    trackingId: string,
    expectedStatus: TransactionStatus,
    nextStatus: TransactionStatus,
    error: string,
  ) {
    await this.update(
      { trackingId, statut: expectedStatus },
      { statut: nextStatus, creditError: error },
    );
    return this.findByTrackingId(trackingId);
  }

  async setCreditErrorIfAwaitingAdmin(trackingId: string, creditError: string) {
    await this.update(
      { trackingId, statut: TransactionStatus.EN_ATTENTE_ADMIN },
      { creditError },
    );
    return this.findByTrackingId(trackingId);
  }

  rejectExpiredDeposit(trackingId: string, expiredBefore: Date, motif: string, pausedExpirationMs = 0) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOne({
        where: { trackingId },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction
        || transaction.type !== TransactionType.DEPOT
        || transaction.captureReconciliationRequired
        || !!transaction.referencePaiement
        || ![
          TransactionStatus.EN_ATTENTE_AUTO,
          TransactionStatus.EN_VERIFICATION,
          TransactionStatus.EN_ATTENTE_PREUVE,
        ].includes(transaction.statut)
        || transaction.createdAt >= new Date(expiredBefore.getTime() - Math.max(0, pausedExpirationMs - Number(transaction.capturePauseMsAtCreation || 0)))) {
        return null;
      }

      transaction.statut = TransactionStatus.REJETEE;
      transaction.motifRejet = motif;
      transaction.dateValidation = new Date();
      return repository.save(transaction);
    });
  }

  findOpenCandidates(operateur: string, montant: number, since: Date, notificationPostedAt: Date) {
    return this.createQueryBuilder('t')
      .innerJoinAndSelect('t.user', 'user')
      .where('LOWER(t.operateur) = LOWER(:operateur)', { operateur })
      .andWhere('t.type = :type', { type: TransactionType.DEPOT })
      .andWhere('t.montant = :montant', { montant })
      .andWhere('t.createdAt <= :notificationPostedAt', { notificationPostedAt })
      .andWhere('t.statut IN (:...statuts)', {
          statuts: [
            TransactionStatus.EN_ATTENTE_AUTO,
            TransactionStatus.EN_VERIFICATION,
          ],
      })
      .andWhere('t.createdAt >= :since', { since })
      .orderBy('t.createdAt', 'ASC')
      .getMany();
  }

  findStaleAutoWaiting(autoWaitingBefore: Date, pausedExpirationMs = 0) {
    return this.createQueryBuilder('t')
      .where('t.type = :type', { type: TransactionType.DEPOT })
      .andWhere('t.statut IN (:...statuts)', {
        statuts: [
          TransactionStatus.EN_ATTENTE_AUTO,
          TransactionStatus.EN_VERIFICATION,
          TransactionStatus.EN_ATTENTE_PREUVE,
        ],
      })
      .andWhere(
        `t.created_at < CAST(:autoWaitingBefore AS timestamp)
          - GREATEST(CAST(:pausedExpirationMs AS bigint) - t.capture_pause_ms_at_creation, 0) * INTERVAL '1 millisecond'`,
        { autoWaitingBefore, pausedExpirationMs },
      )
      .andWhere('t.referencePaiement IS NULL')
      .andWhere('t.capture_reconciliation_required = false')
      .andWhere('t.creditError IS NULL')
      .getMany();
  }
}
