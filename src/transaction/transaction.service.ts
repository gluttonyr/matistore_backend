import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AdminCaptureDto } from './dto/admin-capture.dto';
import { ResolveClaimDto } from './dto/resolve-claim.dto';
import { Transaction, TransactionStatus, TransactionType, ValidationMethod } from './entities/transaction.entity';
import { MessageService } from '../message/message.service';
import { MessageType } from '../message/entities/message.entity';
import { DiscussionService } from '../discussion/discussion.service';
import { DiscussionStatus, DiscussionType } from '../discussion/entities/discussion.entity';
import { PushDeviceService } from '../push-device/push-device.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import { OperateurService } from '../operateur/operateur.service';
import { ServculService } from '../servcul/servcul.service';
import { UserRole } from '../utilisateur/enums/user-role.enum';
import { MessageGateway } from '../message/message.gatway';
import { AppNotificationService } from '../app-notification/app-notification.service';
import { AdminCaptureAvailabilityService } from './admin-capture-availability.service';
import { AdminCaptureHeartbeatDto } from './dto/admin-capture-heartbeat.dto';
import { ResolveCaptureReconciliationDto } from './dto/resolve-capture-reconciliation.dto';
import { RejectTransactionDto } from './dto/reject-transaction.dto';

const AUTO_TIMEOUT_SECONDS = 180;
const AUTO_TIMEOUT_POLL_MS = 5_000;

@Injectable()
export class TransactionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionService.name);
  private timeoutHandle?: ReturnType<typeof setInterval>;
  private timeoutRunning = false;

  constructor(
    private readonly repository: TransactionRepository,
    private readonly messageService: MessageService,
    private readonly messageGateway: MessageGateway,
    private readonly discussionService: DiscussionService,
    private readonly pushDeviceService: PushDeviceService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly userService: UtilisateurService,
    private readonly operateurService: OperateurService,
    private readonly servculService: ServculService,
    private readonly appNotificationService: AppNotificationService,
    private readonly captureAvailability: AdminCaptureAvailabilityService,
  ) {}

  onModuleInit() {
    this.timeoutHandle = setInterval(() => {
      if (this.timeoutRunning) return;
      this.timeoutRunning = true;
      void this.timeoutStaleTransactions()
        .catch((error) => this.logger.error('Échec du traitement des transactions expirées', error))
        .finally(() => { this.timeoutRunning = false; });
    }, AUTO_TIMEOUT_POLL_MS);
    this.timeoutHandle.unref?.();
  }

  onModuleDestroy() {
    if (this.timeoutHandle) clearInterval(this.timeoutHandle);
  }

  async create(payload: CreateTransactionDto, userId: number) {
    if (payload.type === TransactionType.DEPOT && (!payload.montant || payload.montant < 1)) {
      throw new BadRequestException('Le montant est requis pour un dépôt');
    }
    if (payload.type === TransactionType.DEPOT) {
      const capture = await this.captureAvailability.getStatus();
      if (!capture.available) {
        throw new ServiceUnavailableException('Les dépôts sont temporairement indisponibles : la capture automatique des paiements est hors ligne. Réessayez plus tard.');
      }
    }
    if (payload.type === TransactionType.RETRAIT && !payload.codeRetrait?.trim()) {
      throw new BadRequestException('Le code de retrait est requis');
    }
    if (payload.type === TransactionType.RETRAIT && !payload.operateur?.trim()) {
      throw new BadRequestException('Choisissez un opérateur pour le retrait');
    }
    const accountId = payload.compteDestinataire?.trim();
    if (!accountId || !/^\d+$/.test(accountId)) {
      throw new BadRequestException('Un ID 1XBET numérique est requis');
    }
    const playerId = Number(accountId);
    if (!Number.isSafeInteger(playerId)) {
      throw new BadRequestException('L’ID 1XBET est invalide');
    }
    const player = await this.servculService.findPlayer(playerId);
    if (!player) throw new BadRequestException('ID 1XBET introuvable');
    const transactionDiscussion = await this.discussionService.getDepotRetraitDiscussion(userId);

    const operateur = payload.operateur
      ? await this.operateurService.findByNom(payload.operateur)
      : null;
    if (payload.operateur && (!operateur || !operateur.active)) {
      throw new BadRequestException('Opérateur introuvable ou inactif');
    }
    const transactionData = this.repository.create({
      ...payload,
      montant: payload.montant ?? 0,
      compteDestinataire: String(playerId),
      operateur: operateur?.nom ?? payload.operateur,
      discussionTrackingId: transactionDiscussion.trackingId,
      statut: payload.type === TransactionType.RETRAIT
        ? TransactionStatus.EN_VERIFICATION
        : TransactionStatus.EN_ATTENTE_AUTO,
      user: { id: userId } as any,
    });
    let created: Transaction;
    if (payload.type === TransactionType.DEPOT) {
      const currentCapture = await this.captureAvailability.getStatus();
      if (!currentCapture.available) {
        throw new ServiceUnavailableException('Les dépôts sont temporairement indisponibles : la capture automatique des paiements est hors ligne. Réessayez plus tard.');
      }
      const pausedExpirationMs = await this.captureAvailability.getPausedExpirationMs();
      transactionData.capturePauseMsAtCreation = String(pausedExpirationMs);
      transactionData.captureReconciliationRequired = !currentCapture.deviceAvailable;
      const result = await this.repository.createDepositIfNoOpen(
        userId,
        transactionData,
        new Date(Date.now() - AUTO_TIMEOUT_SECONDS * 1000),
        pausedExpirationMs,
      );
      for (const expired of result.expired) {
        await this.postSystemMessage(expired, `❌ Dépôt expiré.\n${expired.motifRejet}`);
        await this.notifyStatusChange(expired);
      }
      if (!result.transaction) {
        if (!result.existing && !result.expired.length) {
          throw new BadRequestException('Utilisateur introuvable pour créer le dépôt');
        }
        throw new ConflictException(result.existing?.statut === TransactionStatus.EN_RECLAMATION
          ? 'Votre transaction est en réclamation. Attendez notre réponse avant d’en créer une autre.'
          : result.existing?.referencePaiement
          ? 'Votre paiement est confirmé et le crédit du compte est en cours ou nécessite une vérification. Ne relancez pas le paiement.'
          : result.existing?.statut === TransactionStatus.EN_ATTENTE_ADMIN
            ? 'Votre transaction précédente attend encore son traitement. Nous vous informerons dès sa mise à jour.'
            : 'Un dépôt est déjà en cours. Attendez sa vérification ; sans notification valide, il expirera après trois minutes.');
      }
      created = result.transaction;
    } else {
      const createdWithdrawal = await this.repository.createWithdrawalIfCodeUnused(userId, transactionData);
      if (!createdWithdrawal) {
        throw new ConflictException('Ce code de retrait a déjà été soumis et ne sera pas envoyé une seconde fois.');
      }
      created = createdWithdrawal;
      return this.executeAutomaticPayout(created);
    }
    const transaction = await this.repository.findByTrackingId(created.trackingId) ?? created;
    await this.notifyStatusChange(transaction);
    return transaction;
  }

  async validateManualWithdrawal(id: string, adminId: number) {
    await this.assertAdmin(adminId);
    const transaction = await this.repository.validateManualWithdrawal(id, adminId);
    if (!transaction) throw new BadRequestException('Ce retrait n’attend pas une validation de paiement administrateur');
    await this.postSystemMessage(
      transaction,
      `✅ Retrait envoyé au numéro indiqué${transaction.montant > 0 ? ` (${transaction.montant} FCFA)` : ''}.`,
    );
    await this.notifyStatusChange(transaction);
    return transaction;
  }

  async rejectUnvalidated(id: string, adminId: number, dto: RejectTransactionDto) {
    await this.assertAdmin(adminId);
    const motif = dto?.motif?.trim() || undefined;
    const transaction = await this.repository.rejectUnvalidatedTransaction(id, adminId, motif);
    if (!transaction) {
      throw new BadRequestException('Une transaction validée ne peut plus être refusée');
    }
    await this.postSystemMessage(
      transaction,
      `❌ Nous avons refusé votre ${transaction.type === TransactionType.DEPOT ? 'dépôt' : 'retrait'}.${motif ? `\nMotif : ${motif}` : ''}`,
    );
    await this.notifyStatusChange(transaction);
    return transaction;
  }

  getCaptureStatus() { return this.captureAvailability.getStatus(); }

  async captureHeartbeat(adminId: number, dto: AdminCaptureHeartbeatDto) {
    await this.assertAdmin(adminId);
    return this.captureAvailability.heartbeat(adminId, dto.deviceId, dto.ready, dto.reason);
  }

  async setCaptureManualOverride(adminId: number, enabled: boolean) {
    await this.assertAdmin(adminId);
    return this.captureAvailability.setManualOverride(enabled);
  }

  async resolveCaptureReconciliation(id: string, adminId: number, dto: ResolveCaptureReconciliationDto) {
    await this.assertAdmin(adminId);
    if (dto.decision === TransactionStatus.REJETEE && !dto.motif?.trim()) {
      throw new BadRequestException('Un motif est requis pour clore le rapprochement par un refus');
    }
    const transaction = await this.repository.resolveCaptureReconciliation(id, adminId, dto.decision, dto.motif);
    if (!transaction) throw new BadRequestException('Ce dépôt ne nécessite pas de rapprochement manuel');
    this.logger.log(JSON.stringify({
      event: 'transaction.deposit.capture-reconciliation.resolved',
      transactionId: transaction.trackingId,
      adminId,
      decision: dto.decision,
      reason: dto.motif?.trim().slice(0, 400) ?? null,
      paymentReferencePresent: !!transaction.referencePaiement,
    }));
    const message = dto.decision === TransactionStatus.VALIDEE
      ? `✅ Après vérification, nous avons confirmé votre paiement et crédité votre compte 1XBET.\n${this.transactionDetails(transaction)}`
      : `❌ Nous n’avons pas pu confirmer votre dépôt.\nMotif : ${transaction.motifRejet ?? '—'}\n${this.transactionDetails(transaction)}`;
    await this.postSystemMessage(transaction, message);
    await this.notifyStatusChange(transaction);
    return transaction;
  }

  findAdminPage(page: number, limit: number, filters: {
    search?: string; type?: TransactionType; status?: TransactionStatus; discussionId?: string;
  }) {
    return this.repository.findAdminPage(page, limit, filters);
  }

  // Compatibilité avec les anciennes applications qui ne demandent pas de page.
  findAllForAdmin() {
    return this.repository.find({
      relations: { user: true, validePar: true },
      order: { createdAt: 'DESC' },
    });
  }

  findByUser(userId: number) {
    return this.repository.find({
      where: { user: { id: userId } },
      relations: { user: true, validePar: true },
      order: { createdAt: 'DESC' },
    });
  }

  findUserPage(userId: number, page: number, limit: number) {
    return this.repository.findUserPage(userId, page, limit);
  }

  countUpdatedSince(userId: number, since: Date) {
    return this.repository.countUpdatedSince(userId, since);
  }

  async findById(id: string, userId?: number) {
    const entity = await this.repository.findByTrackingId(id);
    if (!entity || (userId !== undefined && entity.user.id !== userId)) {
      throw new BadRequestException('Transaction introuvable');
    }
    return entity;
  }

  async processAdminCapture(
    dto: AdminCaptureDto,
    adminId: number,
  ): Promise<{
    matched: boolean;
    retryable: boolean;
    transactionId?: string;
    message?: string;
    reason?: string;
    extracted?: { montant: number | null; reference: string | null; telephone: string | null };
    transactionSelection?: 'most_recent' | 'unique_match';
    creditSucceeded?: boolean;
  }> {
    await this.assertAdmin(adminId);
    const operateur = await this.operateurService.findByNom(dto.operateur);
    if (!operateur || !operateur.active) {
      throw new BadRequestException('Opérateur introuvable ou inactif');
    }

    const expectedPackage = operateur.notificationPackageAdmin?.trim();
    const receivedPackage = dto.packageNotification?.trim();
    if (expectedPackage && expectedPackage !== receivedPackage) {
      this.logger.warn(JSON.stringify({ event: 'admin.capture.package-mismatch', operateur: operateur.nom }));
      return {
        matched: false,
        retryable: false,
        reason: `Package reçu "${receivedPackage ?? ''}" différent du package configuré "${expectedPackage}".`,
      };
    }

    const expectedTitle = operateur.notificationTitleAdmin?.trim();
    const receivedTitle = dto.titreNotification?.trim();
    if (expectedTitle && expectedTitle.toLocaleLowerCase() !== receivedTitle?.toLocaleLowerCase()) {
      this.logger.warn(JSON.stringify({ event: 'admin.capture.title-mismatch', operateur: operateur.nom }));
      return {
        matched: false,
        retryable: false,
        reason: `Titre reçu "${receivedTitle ?? ''}" différent du titre configuré "${expectedTitle}".`,
      };
    }

    const notificationMatch = this.execNotificationPattern(operateur.notificationPatternAdmin, dto.notificationBrute);
    const amount = this.parseNotificationAmount(notificationMatch?.groups?.montant);
    const reference = notificationMatch?.groups?.reference?.trim();
    const notificationPhone = notificationMatch?.groups?.telephone?.trim();
    const extracted = {
      montant: Number.isFinite(amount) ? amount : null,
      reference: reference || null,
      telephone: notificationPhone || null,
    };
    const debugResult = (matched: boolean, retryable: boolean, reason: string) => ({
      matched,
      retryable,
      reason,
      extracted,
    });
    if (!notificationMatch) {
      return debugResult(false, false, 'Le texte ne correspond pas au modèle de notification configuré.');
    }
    if (amount !== dto.montant) {
      return debugResult(false, false, `Montant de la notification (${amount}) différent du montant reçu (${dto.montant}).`);
    }
    if (!reference) {
      return debugResult(false, false, 'Aucune référence de paiement exploitable dans la notification.');
    }
    if (!notificationPhone || !dto.numeroTelephoneClient
      || !this.phonesMatch(notificationPhone, dto.numeroTelephoneClient)) {
      return debugResult(false, false, 'Le numéro de la notification ne correspond pas au numéro fourni par la transaction.');
    }

    if (await this.repository.findByConfirmedReference(reference)) {
      this.logger.warn(JSON.stringify({ event: 'admin.capture.duplicate-reference', operateur: operateur.nom, reference }));
      return {
        matched: false,
        retryable: false,
        message: 'Cette transaction a déjà été enregistrée.',
        reason: 'La référence de paiement est déjà enregistrée.',
        extracted,
      };
    }

    const notificationPostedAt = new Date(dto.notificationPostedAt ?? Date.now());
    const since = new Date(notificationPostedAt.getTime() - AUTO_TIMEOUT_SECONDS * 1000);
    let candidates = await this.repository.findOpenCandidates(
      operateur.nom,
      dto.montant,
      since,
      notificationPostedAt,
    );
    candidates = candidates.filter((candidate) =>
      candidate.createdAt <= notificationPostedAt
      && candidate.createdAt >= since
      && candidate.numeroTelephone
      && this.phonesMatch(candidate.numeroTelephone, notificationPhone),
    );
    if (candidates.length === 0) {
      this.logger.warn(JSON.stringify({ event: 'admin.capture.no-match', operateur: operateur.nom, montant: dto.montant }));
      return debugResult(false, true, 'Aucune transaction en attente ne correspond à cet opérateur, montant et numéro.');
    }

    candidates.sort((first, second) =>
      second.createdAt.getTime() - first.createdAt.getTime()
      || second.trackingId.localeCompare(first.trackingId),
    );
    const selectedCandidate = candidates[0];
    if (candidates.length > 1) {
      this.logger.warn(JSON.stringify({
        event: 'admin.capture.multiple-candidates',
        operateur: operateur.nom,
        montant: dto.montant,
        candidateCount: candidates.length,
        selectedTransactionId: selectedCandidate.trackingId,
      }));
    }

    try {
      const saved = await this.markCapturedDeposit(
        selectedCandidate.trackingId,
        reference,
        dto.notificationBrute,
      );
      if (!saved.transaction) return debugResult(false, false, 'La transaction a changé d’état avant son enregistrement.');
      this.logger.log(JSON.stringify({
        event: 'admin.capture.matched',
        transactionId: saved.transaction.trackingId,
        creditSucceeded: saved.credited,
      }));
      return {
        matched: true,
        retryable: false,
        transactionId: saved.transaction.trackingId,
        creditSucceeded: saved.credited,
        reason: saved.credited
          ? 'Paiement vérifié et crédit Servcul confirmé.'
          : 'Paiement vérifié, mais le crédit Servcul reste à traiter.',
        extracted,
        transactionSelection: candidates.length > 1 ? 'most_recent' : 'unique_match',
      };
    } catch (error) {
      const driverError = (error as { driverError?: { code?: string } }).driverError;
      if (error instanceof ConflictException || driverError?.code === '23505') {
        this.logger.warn(JSON.stringify({ event: 'admin.capture.duplicate-reference-race', operateur: operateur.nom, reference }));
        return {
          matched: false,
          retryable: false,
          message: 'Cette transaction a déjà été enregistrée.',
          reason: 'La référence de paiement est déjà enregistrée (conflit détecté lors de la sauvegarde).',
          extracted,
        };
      }
      throw error;
    }
  }

  private execNotificationPattern(pattern: string | undefined, notification: string): RegExpExecArray | null {
    if (!pattern) return null;
    try {
      return new RegExp(pattern).exec(notification);
    } catch (error) {
      this.logger.error('Modèle de notification opérateur invalide', error);
      throw new BadRequestException('Le modèle de notification de cet opérateur est invalide');
    }
  }

  private parseNotificationAmount(value?: string): number {
    if (!value) return NaN;
    const digits = value
      .replace(/\s/g, '')
      .replace(/[,.]\d{2}$/, '')
      .replace(/[^0-9]/g, '');
    return digits ? Number.parseInt(digits, 10) : NaN;
  }

  private phonesMatch(first: string, second: string): boolean {
    const a = first.replace(/\D/g, '');
    const b = second.replace(/\D/g, '');
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    return shorter.length >= 8 && longer.endsWith(shorter);
  }

  private async markCapturedDeposit(
    trackingId: string,
    reference: string,
    notification: string,
  ): Promise<{ transaction: Transaction | null; credited: boolean }> {
    const saved = await this.repository.markDepositAsVerified(trackingId, reference, notification);
    if (!saved) return { transaction: null, credited: false };

    await this.postSystemMessage(
      saved,
      '✅ Paiement reçu. Nous créditons votre compte 1XBET.',
    );
    await this.notifyStatusChange(saved);
    try {
      const completed = await this.repository.completeAutomaticTransaction(
        trackingId,
        (transaction) => this.executeServculTransaction(transaction),
        ValidationMethod.AUTO_NOTIFICATION,
        [TransactionStatus.EN_VERIFICATION],
      );
      if (!completed) {
        const current = await this.repository.findByTrackingId(trackingId);
        this.logger.warn(JSON.stringify({
          event: 'transaction.servcul.auto-credit.skipped',
          transactionId: trackingId,
          currentStatus: current?.statut ?? null,
          paymentReferencePresent: !!current?.referencePaiement,
        }));
        return { transaction: current, credited: false };
      }
      await this.postSystemMessage(
        completed,
        `✅ Dépôt validé. Votre compte 1XBET a été crédité${completed.montant > 0 ? ` de ${completed.montant} FCFA` : ''}.`,
      );
      await this.notifyStatusChange(completed);
      return { transaction: completed, credited: true };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'transaction.servcul.auto-credit.failed',
          transactionId: trackingId,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      const creditError = 'Votre paiement a été reçu, mais nous n’avons pas encore pu créditer votre compte 1XBET. Nous vérifions la transaction. Ne recommencez pas le dépôt.';
      const current = await this.repository.setAutomaticTransactionError(
        trackingId,
        TransactionStatus.EN_VERIFICATION,
        TransactionStatus.EN_ATTENTE_PREUVE,
        creditError,
      );
      if (current?.statut === TransactionStatus.EN_ATTENTE_PREUVE) {
        await this.postSystemMessage(
          current,
          '⚠️ Votre paiement a été reçu, mais le crédit de votre compte 1XBET n’a pas encore abouti. Nous vérifions la transaction. Ne recommencez pas le dépôt.',
        );
        await this.notifyStatusChange(current);
      }
      return { transaction: current ?? saved, credited: false };
    }
  }

  async timeoutStaleTransactions(): Promise<void> {
    const capture = await this.captureAvailability.getStatus();
    if (!capture.available) return;
    const now = Date.now();
    const expiredBefore = new Date(now - AUTO_TIMEOUT_SECONDS * 1000);
    const pausedMs = await this.captureAvailability.getPausedExpirationMs();
    const stale = await this.repository.findStaleAutoWaiting(
      expiredBefore,
      pausedMs,
    );
    for (const entity of stale) {
      const saved = await this.repository.rejectExpiredDeposit(
        entity.trackingId,
        expiredBefore,
        'Aucune notification de paiement valide reçue dans le délai de trois minutes.',
        pausedMs,
      );
      if (!saved) continue;
      await this.postSystemMessage(saved, `❌ Dépôt refusé.\n${saved.motifRejet}`);
      await this.notifyStatusChange(saved);
    }
  }

  async cancel(id: string, userId: number) {
    const entity = await this.findById(id, userId);
    if ([TransactionStatus.VALIDEE, TransactionStatus.REJETEE, TransactionStatus.ANNULEE].includes(entity.statut)) {
      throw new BadRequestException('Cette transaction ne peut plus être annulée');
    }
    let saved: Transaction | null;
    if (entity.type === TransactionType.DEPOT) {
      saved = await this.repository.cancelPendingDeposit(id, userId);
      if (!saved) {
        throw new BadRequestException('Ce dépôt a déjà été vérifié ou ne peut plus être annulé');
      }
    } else {
      entity.statut = TransactionStatus.ANNULEE;
      saved = await this.repository.save(entity);
    }
    await this.postSystemMessage(saved, '❌ Votre dépôt a été annulé.');
    await this.notifyStatusChange(saved);
    return saved;
  }

  async claimRejected(id: string, userId: number) {
    const saved = await this.repository.claimRejectedTransaction(id, userId);
    if (!saved) {
      throw new BadRequestException('Seule une transaction refusée sans réclamation déjà traitée peut être réclamée');
    }
    await this.postSystemMessage(saved, this.claimChatMessage(saved));
    await this.notifyStatusChange(saved);
    return saved;
  }

  async resolveClaim(id: string, adminId: number, dto: ResolveClaimDto) {
    await this.assertAdmin(adminId);
    if (dto.decision === TransactionStatus.REJETEE && !dto.motif?.trim()) {
      throw new BadRequestException('Un motif est requis pour rejeter la réclamation');
    }
    const saved = await this.repository.resolveClaim(id, adminId, dto.decision, dto.motif);
    if (!saved) throw new BadRequestException('Cette transaction n’attend pas une réclamation');

    const label = saved.type === TransactionType.DEPOT ? 'dépôt' : 'retrait';
    const resultMessage = dto.decision === TransactionStatus.VALIDEE
      ? `✅ Après vérification, nous avons validé votre ${label}.`
      : `❌ Après vérification, nous n’avons pas pu valider votre ${label}.\nMotif : ${saved.motifRejet}`;
    await this.postSystemMessage(saved, resultMessage);
    await this.notifyStatusChange(saved);
    return saved;
  }

  async update(id: string, payload: UpdateTransactionDto, adminId: number) {
    const entity = await this.findById(id);
    const previousStatus = entity.statut;
    const statusChanged = payload.statut !== undefined && payload.statut !== previousStatus;
    if (statusChanged) {
      throw new BadRequestException('Le statut de la transaction est géré automatiquement');
    }
    if (statusChanged && [TransactionStatus.VALIDEE, TransactionStatus.REJETEE, TransactionStatus.ANNULEE].includes(previousStatus)) {
      throw new BadRequestException('Une transaction terminÃ©e ne peut plus changer d\u2019Ã©tape');
    }
    if (payload.statut === TransactionStatus.VALIDEE && entity.statut !== TransactionStatus.VALIDEE) {
      throw new BadRequestException('Utilisez la validation dédiée pour valider une transaction');
    }
    if (payload.statut === TransactionStatus.REJETEE && !payload.motifRejet?.trim() && !entity.motifRejet?.trim()) {
      throw new BadRequestException('Un motif est requis pour refuser la transaction');
    }

    Object.assign(entity, payload);
    if (entity.statut === TransactionStatus.REJETEE) entity.creditError = null;
    if ([TransactionStatus.VALIDEE, TransactionStatus.REJETEE].includes(entity.statut)) {
      entity.dateValidation = new Date();
      entity.validePar = { id: adminId } as any;
      if (entity.statut === TransactionStatus.VALIDEE) entity.methodeValidation = ValidationMethod.ADMIN_MANUEL;
    }
    const saved = await this.repository.save(entity);
    if (statusChanged) {
      await this.postSystemMessage(saved, this.transactionStatusMessage(saved));
      await this.notifyStatusChange(saved);
    }
    return saved;
  }

  private async assertAdmin(adminId: number): Promise<void> {
    const admin = await this.userService.findUserById(adminId);
    if (!admin || admin.role !== UserRole.ADMIN || !admin.active) {
      throw new ForbiddenException('Seul un administrateur actif peut traiter cette opération');
    }
  }

  private async executeServculTransaction(transaction: Transaction): Promise<void> {
    const accountId = transaction.compteDestinataire?.trim();
    const playerId = accountId && /^\d+$/.test(accountId) ? Number(accountId) : NaN;
    if (!Number.isSafeInteger(playerId)) {
      throw new BadRequestException('ID 1XBET manquant ou invalide');
    }

    if (transaction.type === TransactionType.DEPOT) {
      await this.servculService.addPlayerDeposit(playerId, {
        lng: 'ru',
        summa: transaction.montant,
      });
      return;
    }
    if (!transaction.codeRetrait?.trim()) {
      throw new BadRequestException('Code de retrait manquant');
    }
    const payout = await this.servculService.payoutPlayer(playerId, {
      lng: 'ru',
      code: transaction.codeRetrait.trim(),
    });
    const payoutAmount = Number(payout.summa);
    const absolutePayoutAmount = Math.abs(payoutAmount);
    transaction.montant = payout.summa !== null && Number.isSafeInteger(absolutePayoutAmount) && absolutePayoutAmount > 0
      ? absolutePayoutAmount
      : transaction.montant;
  }

  private async executeAutomaticPayout(transaction: Transaction): Promise<Transaction> {
    try {
      const completed = await this.repository.markWithdrawalDebited(
        transaction.trackingId,
        (lockedTransaction) => this.executeServculTransaction(lockedTransaction),
      );
      if (!completed) throw new ConflictException('Le retrait a changé d’état pendant son traitement');
      await this.postSystemMessage(
        completed,
        `✅ Demande de retrait validée. Votre compte 1XBET a été débité${completed.montant > 0 ? ` de ${completed.montant} FCFA` : ''}. Patientez pendant la préparation de l’envoi au numéro indiqué.`,
      );
      await this.notifyStatusChange(completed);
      return completed;
    } catch (error) {
      this.logger.error(
        JSON.stringify({ event: 'transaction.servcul.auto-payout.failed', transactionId: transaction.trackingId }),
        error instanceof Error ? error.stack : undefined,
      );
      const message = this.getPayoutFailureMessage(error);
      const current = await this.repository.setAutomaticTransactionError(
        transaction.trackingId,
        TransactionStatus.EN_VERIFICATION,
        TransactionStatus.EN_ATTENTE_PREUVE,
        message,
      );
      if (current) {
        await this.postSystemMessage(
          current,
          `⚠️ ${message}`,
        );
        await this.notifyStatusChange(current);
        return current;
      }
      throw error;
    }
  }

  private getPayoutFailureMessage(error: unknown): string {
    const getResponse = (error as { getResponse?: () => unknown } | null)?.getResponse;
    if (typeof getResponse === 'function') {
      const payload = getResponse.call(error);
      if (payload && typeof payload === 'object') {
        const upstream = (payload as Record<string, unknown>).upstreamResponse;
        const findMessage = (value: unknown): string | null => {
          if (Array.isArray(value)) {
            for (const item of value) {
              const message = findMessage(item);
              if (message) return message;
            }
            return null;
          }
          if (!value || typeof value !== 'object') return null;
          const record = value as Record<string, unknown>;
          for (const key of ['message', 'error', 'description', 'reason', 'detail']) {
            const candidate = record[key];
            if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
          }
          for (const nested of Object.values(record)) {
            const message = findMessage(nested);
            if (message) return message;
          }
          return null;
        };
        const servculMessage = findMessage(upstream);
        if (servculMessage) return servculMessage.slice(0, 400);

        const reason = typeof upstream === 'string' ? upstream.toLocaleLowerCase() : '';
        const invalidCode = (
          /code|код/.test(reason)
          && /invalid|incorrect|wrong|expired|невер|неправ|ист[её]к/.test(reason)
        );
        if (invalidCode) return 'Code de retrait invalide ou expiré. Vérifiez le code dans votre compte 1XBET puis réessayez.';
      }
    }
    return 'Le code de retrait n’a pas pu être confirmé pour le moment. Ne le renvoyez pas. Nous vérifions votre demande.';
  }

  private transactionStatusMessage(transaction: Transaction): string {
    if (transaction.statut === TransactionStatus.EN_VERIFICATION && transaction.type === TransactionType.DEPOT && transaction.referencePaiement) {
      return 'Votre paiement a été reçu et nous créditons votre compte 1XBET.';
    }
    const label = transaction.type === TransactionType.DEPOT ? 'Dépôt' : 'Retrait';
    switch (transaction.statut) {
      case TransactionStatus.EN_ATTENTE_AUTO: return 'Nous vérifions votre paiement.';
      case TransactionStatus.EN_VERIFICATION: return transaction.type === TransactionType.RETRAIT
        ? 'Nous vérifions votre code de retrait et votre compte 1XBET.'
        : 'Nous vérifions votre transaction.';
      case TransactionStatus.EN_ATTENTE_PREUVE: return transaction.type === TransactionType.RETRAIT
        ? 'Le code de retrait n’a pas pu être confirmé pour le moment. Nous vérifions votre demande. Ne renvoyez pas ce code.'
        : 'Nous n’avons pas encore pu confirmer votre paiement. Nous vérifions votre demande avant que vous ne recommenciez.';
      case TransactionStatus.EN_ATTENTE_ADMIN:
        return transaction.type === TransactionType.RETRAIT
          ? `Demande de retrait validée. Votre compte 1XBET a été débité${transaction.montant > 0 ? ` de ${transaction.montant} FCFA` : ''}. Patientez pendant la préparation de l’envoi au numéro indiqué.`
          : 'Votre dépôt attend encore son traitement. Nous vous informerons dès sa mise à jour.';
      case TransactionStatus.EN_RECLAMATION: return `Nous vérifions votre réclamation concernant le ${label.toLowerCase()}.`;
      case TransactionStatus.VALIDEE: return transaction.type === TransactionType.DEPOT
        ? `Dépôt validé. Votre compte 1XBET a été crédité${transaction.montant > 0 ? ` de ${transaction.montant} FCFA` : ''}.`
        : `Retrait envoyé au numéro indiqué${transaction.montant > 0 ? ` (${transaction.montant} FCFA)` : ''}.`;
      case TransactionStatus.REJETEE: return `Nous avons refusé votre ${label.toLowerCase()}.${transaction.motifRejet ? ` ${transaction.motifRejet}` : ''}`;
      case TransactionStatus.ANNULEE: return `${label} annulé.`;
    }
  }

  private async postSystemMessage(transaction: Transaction, contenu: string) {
    try {
      await this.messageService.create({
        contenu,
        discussion: { trackingId: transaction.discussionTrackingId } as any,
        sender: { trackingId: transaction.user.trackingId } as any,
        type: MessageType.TEXT,
      }, transaction.type === TransactionType.DEPOT ? DiscussionStatus.DEPOT : DiscussionStatus.RETRAIT);
    } catch (error) {
      this.logger.error('Échec de la publication du message système transaction', error);
    }
  }

  private async notifyStatusChange(transaction: Transaction) {
    this.emitTransactionStatusChange(transaction);
    const body = this.statusMessage(transaction);
    if (transaction.statut === TransactionStatus.EN_VERIFICATION
      || (transaction.type === TransactionType.RETRAIT && transaction.statut === TransactionStatus.EN_ATTENTE_ADMIN)
      || transaction.statut === TransactionStatus.EN_RECLAMATION
      || transaction.statut === TransactionStatus.VALIDEE
      || transaction.statut === TransactionStatus.REJETEE
      || !!transaction.creditError) {
      const label = transaction.type === TransactionType.DEPOT ? 'Dépôt' : 'Retrait';
      const title = transaction.statut === TransactionStatus.VALIDEE
        ? `${label} réussi`
        : transaction.statut === TransactionStatus.REJETEE
          ? `${label} refusé`
        : transaction.statut === TransactionStatus.EN_RECLAMATION
          ? 'Réclamation reçue'
        : transaction.type === TransactionType.RETRAIT && transaction.statut === TransactionStatus.EN_ATTENTE_ADMIN
            ? 'Retrait en cours'
        : transaction.statut === TransactionStatus.EN_ATTENTE_PREUVE
          ? `${transaction.type === TransactionType.DEPOT ? 'Paiement' : 'Code de retrait'} à vérifier`
            : `${label} en attente`;
      try {
        await this.appNotificationService.createForUser(transaction.user.id, title, body);
      } catch (error) {
        this.logger.error('Échec de l’enregistrement de la notification du dépôt', error);
      }
    }
    try {
      const clientDevices = await this.pushDeviceService.findActiveByUser(transaction.user.id);
      const clientTokens = clientDevices.map((device) => device.token);
      const adminTokens = await this.userService.getAdminPushTokens();
      const userName = `${transaction.user.prenom ?? ''} ${transaction.user.nom ?? ''}`.trim();
      const data = {
        type: 'transaction',
        trackingId: transaction.trackingId,
        discussionId: transaction.discussionTrackingId,
        discussionType: DiscussionType.DEPOT_RETRAIT,
        discussionStatus: transaction.type === TransactionType.DEPOT ? DiscussionStatus.DEPOT : DiscussionStatus.RETRAIT,
        transactionType: transaction.type,
        userName,
      };
      const clientData = {
        ...data,
        recipientTrackingIds: [transaction.user.trackingId],
      };
      const adminData = {
        ...data,
        recipientRoles: [UserRole.ADMIN],
      };
      const clientTitle = transaction.statut === TransactionStatus.VALIDEE
        ? `${transaction.type === TransactionType.DEPOT ? 'Dépôt' : 'Retrait'} réussi`
        : transaction.statut === TransactionStatus.REJETEE
          ? `${transaction.type === TransactionType.DEPOT ? 'Dépôt' : 'Retrait'} refusé`
          : transaction.statut === TransactionStatus.EN_RECLAMATION
            ? 'Réclamation reçue'
          : transaction.type === TransactionType.RETRAIT && transaction.statut === TransactionStatus.EN_ATTENTE_ADMIN
            ? 'Retrait en cours'
          : transaction.statut === TransactionStatus.EN_ATTENTE_PREUVE
            ? `${transaction.type === TransactionType.DEPOT ? 'Paiement' : 'Code de retrait'} à vérifier`
          : transaction.creditError
            ? `${transaction.type === TransactionType.DEPOT ? 'Dépôt' : 'Retrait'} en attente`
            : transaction.statut === TransactionStatus.EN_VERIFICATION
              ? transaction.type === TransactionType.DEPOT ? 'Paiement reçu' : 'Retrait en vérification'
              : 'MatiStore';
      const adminTitle = transaction.type === TransactionType.RETRAIT && transaction.statut === TransactionStatus.EN_ATTENTE_ADMIN
        ? 'Retrait à envoyer au client'
        : transaction.statut === TransactionStatus.EN_RECLAMATION
          ? 'Nouvelle réclamation'
          : 'MatiStore';
      if (clientTokens.length) await this.pushNotificationService.sendToTokens(clientTokens, clientTitle, body, clientData);
      if (adminTokens.length) {
        const adminBody = transaction.statut === TransactionStatus.EN_RECLAMATION
          ? `${userName || 'Un utilisateur'} réclame sa transaction.\n${this.claimChatMessage(transaction)}\n${this.transactionDetails(transaction)}`
          : `Transaction ${transaction.user.nom ?? ''} : ${body}\n${this.transactionDetails(transaction)}`;
        await this.pushNotificationService.sendToTokens(
          adminTokens,
          adminTitle,
          adminBody,
          adminData,
        );
      }
    } catch (error) {
      this.logger.error('Échec de la notification de changement de statut', error);
    }
  }

  private emitTransactionStatusChange(transaction: Transaction) {
    this.messageGateway.emitTransactionStatusChanged({
      trackingId: transaction.trackingId,
      discussionTrackingId: transaction.discussionTrackingId,
      user: transaction.user,
      type: transaction.type,
      statut: transaction.statut,
      montant: transaction.montant,
      updatedAt: transaction.updatedAt,
    });
  }

  private statusMessage(transaction: Transaction): string {
    if (transaction.statut === TransactionStatus.EN_RECLAMATION) {
      return 'Nous avons reçu votre réclamation. Nous vous informerons après vérification.';
    }
    if (transaction.creditError) {
      return transaction.creditError;
    }
    if (transaction.type === TransactionType.DEPOT && transaction.statut === TransactionStatus.VALIDEE) {
      const result = transaction.methodeValidation === ValidationMethod.ADMIN_MANUEL
        ? 'Après vérification, nous avons accepté votre réclamation et crédité votre compte 1XBET.'
        : 'Votre dépôt a été crédité avec succès sur votre compte 1XBET.';
      return result;
    }
    if (transaction.statut === TransactionStatus.REJETEE) {
      return `Nous avons refusé votre ${transaction.type === TransactionType.DEPOT ? 'dépôt' : 'retrait'}.${transaction.motifRejet ? ` ${transaction.motifRejet}` : ''}`;
    }
    if (transaction.type === TransactionType.RETRAIT && transaction.statut === TransactionStatus.VALIDEE) {
      return `Retrait envoyé au numéro indiqué${transaction.montant > 0 ? ` (${transaction.montant} FCFA)` : ''}.`;
    }
    if (transaction.statut === TransactionStatus.EN_ATTENTE_AUTO && transaction.type === TransactionType.DEPOT) {
      return 'Nous vérifions votre paiement.';
    }
    if (transaction.type === TransactionType.RETRAIT && transaction.statut === TransactionStatus.EN_VERIFICATION) {
      return 'Nous vérifions votre code de retrait. Vous recevrez une notification dès que le résultat sera confirmé.';
    }
    return this.transactionStatusMessage(transaction);
  }

  private transactionDetails(transaction: Transaction): string {
    return [
      `Transaction : ${transaction.trackingId}`,
      `Type : ${transaction.type === TransactionType.DEPOT ? 'Dépôt' : 'Retrait'}`,
      ...(transaction.operateur ? [`Opérateur : ${transaction.operateur}`] : []),
      `Date de demande : ${transaction.createdAt.toLocaleString('fr-FR')}`,
      ...(transaction.montant > 0 ? [`Montant : ${transaction.montant} FCFA`] : []),
      `Numéro : ${transaction.numeroTelephone || '—'}`,
      ...(transaction.type === TransactionType.RETRAIT && transaction.compteDestinataire
        ? [`Compte 1XBET : ${transaction.compteDestinataire}`]
        : []),
      ...(transaction.codeRetrait ? [`Code de retrait : ${transaction.codeRetrait}`] : []),
      ...(transaction.referencePaiement ? [`Référence : ${transaction.referencePaiement}`] : []),
      ...(transaction.dateReclamation
        ? [`Date de réclamation : ${transaction.dateReclamation.toLocaleString('fr-FR')}`]
        : []),
    ].join('\n');
  }

  private claimChatMessage(transaction: Transaction): string {
    const label = transaction.type === TransactionType.DEPOT ? 'dépôt' : 'retrait';
    return `📣 Nous avons reçu votre réclamation concernant votre ${label}. Nous vous informerons après vérification. Référence : ${transaction.trackingId}.`;
  }
}
