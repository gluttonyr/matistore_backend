import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ClientReferenceDto } from './dto/client-reference.dto';
import { AdminCaptureDto } from './dto/admin-capture.dto';
import { RejectTransactionDto } from './dto/reject-transaction.dto';
import { Transaction, TransactionStatus, TransactionType, ValidationMethod } from './entities/transaction.entity';
import { MessageService } from '../message/message.service';
import { MessageType } from '../message/entities/message.entity';
import { DiscussionService } from '../discussion/discussion.service';
import { DiscussionStatus, DiscussionType } from '../discussion/entities/discussion.entity';
import { PushDeviceService } from '../push-device/push-device.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import { OperateurService } from '../operateur/operateur.service';

const MATCHING_WINDOW_MINUTES = 30;
const AUTO_TIMEOUT_SECONDS = 30;
const REFERENCE_TIMEOUT_SECONDS = MATCHING_WINDOW_MINUTES * 60;
const AUTO_TIMEOUT_POLL_MS = 10_000;

@Injectable()
export class TransactionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionService.name);
  private timeoutHandle?: ReturnType<typeof setInterval>;
  private timeoutRunning = false;

  constructor(
    private readonly repository: TransactionRepository,
    private readonly messageService: MessageService,
    private readonly discussionService: DiscussionService,
    private readonly pushDeviceService: PushDeviceService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly userService: UtilisateurService,
    private readonly operateurService: OperateurService,
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
    const clientReference = payload.type === TransactionType.DEPOT
      ? payload.referenceClient?.trim() || undefined
      : undefined;
    const transactionDiscussion = await this.discussionService.getDepotRetraitDiscussion(userId);

    const operateur = payload.operateur
      ? await this.operateurService.findByNom(payload.operateur)
      : null;
    if (payload.operateur && (!operateur || !operateur.active)) {
      throw new BadRequestException('Opérateur introuvable ou inactif');
    }
    const created = await this.repository.save(this.repository.create({
      ...payload,
      referenceClient: clientReference,
      notificationBruteClient: payload.type === TransactionType.DEPOT ? payload.notificationBruteClient : undefined,
      montant: payload.montant ?? 0,
      operateur: operateur?.nom ?? payload.operateur,
      discussionTrackingId: transactionDiscussion.trackingId,
      statut: payload.type === TransactionType.RETRAIT
        ? TransactionStatus.EN_ATTENTE_ADMIN
        : clientReference
          ? TransactionStatus.EN_VERIFICATION
          : TransactionStatus.EN_ATTENTE_AUTO,
      user: { id: userId } as any,
    }));
    const transaction = await this.repository.findByTrackingId(created.trackingId) ?? created;
    if (transaction.type === TransactionType.DEPOT && transaction.referenceClient) {
      await this.postSystemMessage(
        transaction,
        `🔎 Référence détectée : ${transaction.referenceClient}\nVérification du dépôt en cours...`,
      );
    }
    await this.notifyStatusChange(transaction);
    return transaction;
  }

  findByUser(userId: number) { return this.repository.findByUser(userId); }

  findAllForAdmin() {
    return this.repository.find({
      relations: { user: true, validePar: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId?: number) {
    const entity = await this.repository.findByTrackingId(id);
    if (!entity || (userId !== undefined && entity.user.id !== userId)) {
      throw new BadRequestException('Transaction introuvable');
    }
    return entity;
  }

  async reportClientReference(id: string, userId: number, dto: ClientReferenceDto) {
    const entity = await this.findById(id, userId);
    if (entity.statut !== TransactionStatus.EN_ATTENTE_AUTO) return entity;

    // La déclaration client reste séparée de la référence confirmée par l'admin.
    entity.referenceClient = dto.referencePaiement;
    entity.notificationBruteClient = dto.notificationBrute;
    entity.statut = TransactionStatus.EN_VERIFICATION;
    const saved = await this.repository.save(entity);
    await this.postSystemMessage(saved, `🔎 Référence détectée : ${dto.referencePaiement}\nVérification en cours...`);
    await this.notifyStatusChange(saved);
    return saved;
  }

  async processAdminCapture(dto: AdminCaptureDto): Promise<{ matched: boolean; retryable: boolean; transactionId?: string }> {
    const operateur = await this.operateurService.findByNom(dto.operateur);
    if (!operateur || !operateur.active) {
      throw new BadRequestException('Opérateur introuvable ou inactif');
    }

    const reference = dto.referencePaiement.trim();
    if (!reference) return { matched: false, retryable: false };
    const expectedPackage = operateur.notificationPackageAdmin?.trim();
    const receivedPackage = dto.packageNotification?.trim();
    if (expectedPackage && expectedPackage !== receivedPackage) {
      this.logger.warn(JSON.stringify({ event: 'admin.capture.package-mismatch', operateur: operateur.nom }));
      return { matched: false, retryable: false };
    }
    if (await this.repository.findByConfirmedReference(reference)) {
      this.logger.warn(JSON.stringify({ event: 'admin.capture.duplicate-reference', operateur: operateur.nom, reference }));
      return { matched: false, retryable: false };
    }

    const since = new Date(Date.now() - MATCHING_WINDOW_MINUTES * 60_000);
    let candidates = await this.repository.findOpenCandidates(operateur.nom, dto.montant, since);
    if (dto.numeroTelephoneClient) {
      const notificationPhone = dto.numeroTelephoneClient.replace(/\D/g, '');
      const byPhone = candidates.filter((candidate) => candidate.numeroTelephone?.replace(/\D/g, '') === notificationPhone);
      if (byPhone.length === 0) return { matched: false, retryable: true };
      candidates = byPhone;
    }
    if (candidates.length === 0) {
      this.logger.warn(JSON.stringify({ event: 'admin.capture.no-match', operateur: operateur.nom, montant: dto.montant }));
      return { matched: false, retryable: true };
    }

    let match: Transaction | undefined;
    if (operateur.nom.toLowerCase() === 'flooz') {
      const withClientReference = candidates.filter((candidate) => candidate.referenceClient?.trim());
      if (withClientReference.length > 0) {
        const referenceMatches = withClientReference.filter((candidate) => candidate.referenceClient?.trim() === reference);
        if (referenceMatches.length !== 1) {
          this.logger.warn(JSON.stringify({ event: 'admin.capture.flooz-reference-match-not-unique', operateur: operateur.nom, montant: dto.montant }));
          return { matched: false, retryable: true };
        }
        match = referenceMatches[0];
      } else if (candidates.length === 1) {
        // Compatibilité pour les demandes Flooz créées avec une preuve/USSD sans référence client.
        match = candidates[0];
      } else {
        this.logger.warn(JSON.stringify({ event: 'admin.capture.ambiguous-flooz-match', operateur: operateur.nom, montant: dto.montant }));
        return { matched: false, retryable: true };
      }
    } else {
      match = candidates.find((candidate) => candidate.referenceClient?.trim() === reference);
    }
    if (!match) return { matched: false, retryable: true };

    // Ne jamais recopier la référence déclarée par le client dans le champ confirmé.
    match.referencePaiement = reference;
    match.notificationBrute = dto.notificationBrute;
    match.statut = TransactionStatus.EN_ATTENTE_ADMIN;
    match.methodeValidation = undefined;
    match.dateValidation = undefined;
    let saved: Transaction;
    try {
      saved = await this.repository.save(match);
    } catch (error) {
      const driverError = (error as { driverError?: { code?: string } }).driverError;
      if (driverError?.code === '23505') {
        this.logger.warn(JSON.stringify({ event: 'admin.capture.duplicate-reference-race', operateur: operateur.nom, reference }));
        return { matched: false, retryable: false };
      }
      throw error;
    }
    await this.postSystemMessage(
      saved,
      `✅ Paiement détecté et vérifié automatiquement. Un administrateur doit encore confirmer le crédit.\nRéférence : ${reference}`,
    );
    await this.notifyStatusChange(saved);
    this.logger.log(JSON.stringify({ event: 'admin.capture.matched', transactionId: saved.trackingId }));
    return { matched: true, retryable: false, transactionId: saved.trackingId };
  }

  async timeoutStaleTransactions(): Promise<void> {
    const now = Date.now();
    const stale = await this.repository.findStaleAutoWaiting(
      new Date(now - AUTO_TIMEOUT_SECONDS * 1000),
      new Date(now - REFERENCE_TIMEOUT_SECONDS * 1000),
    );
    for (const entity of stale) {
      // Relecture avant écriture pour ne pas écraser un matching ou une annulation concurrente.
      const current = await this.repository.findByTrackingId(entity.trackingId);
      if (!current || ![TransactionStatus.EN_ATTENTE_AUTO, TransactionStatus.EN_VERIFICATION].includes(current.statut)) continue;
      current.statut = TransactionStatus.EN_ATTENTE_PREUVE;
      const saved = await this.repository.save(current);
      await this.postSystemMessage(saved, '⚠️ Vérification automatique non aboutie.\nVeuillez joindre une preuve de paiement.');
      await this.notifyStatusChange(saved);
    }
  }

  async submitProof(id: string, userId: number, preuveFichier: string) {
    const entity = await this.findById(id, userId);
    if (![TransactionStatus.EN_ATTENTE_AUTO, TransactionStatus.EN_VERIFICATION, TransactionStatus.EN_ATTENTE_PREUVE].includes(entity.statut)) {
      throw new BadRequestException('Cette transaction ne peut pas recevoir de preuve');
    }
    entity.preuveFichier = preuveFichier;
    entity.statut = TransactionStatus.EN_ATTENTE_ADMIN;
    const saved = await this.repository.save(entity);
    await this.notifyStatusChange(saved);
    return saved;
  }

  async cancel(id: string, userId: number) {
    const entity = await this.findById(id, userId);
    if ([TransactionStatus.VALIDEE, TransactionStatus.REJETEE, TransactionStatus.ANNULEE].includes(entity.statut)) {
      throw new BadRequestException('Cette transaction ne peut plus être annulée');
    }
    entity.statut = TransactionStatus.ANNULEE;
    const saved = await this.repository.save(entity);
    await this.notifyStatusChange(saved);
    return saved;
  }

  async validateManually(id: string, adminId: number) {
    const entity = await this.findById(id);
    if (entity.statut !== TransactionStatus.EN_ATTENTE_ADMIN) {
      throw new BadRequestException('Cette transaction n’attend pas une validation manuelle');
    }
    entity.statut = TransactionStatus.VALIDEE;
    entity.methodeValidation = ValidationMethod.ADMIN_MANUEL;
    entity.dateValidation = new Date();
    entity.validePar = { id: adminId } as any;
    const saved = await this.repository.save(entity);
    await this.postSystemMessage(saved, `${saved.type === TransactionType.DEPOT ? '✅ Dépôt' : '✅ Retrait'} validé par un administrateur.`);
    await this.notifyStatusChange(saved);
    return saved;
  }

  async reject(id: string, adminId: number, dto: RejectTransactionDto) {
    const entity = await this.findById(id);
    if (entity.statut !== TransactionStatus.EN_ATTENTE_ADMIN) {
      throw new BadRequestException('Cette transaction n’attend pas une décision manuelle');
    }
    entity.statut = TransactionStatus.REJETEE;
    entity.motifRejet = dto.motif;
    entity.dateValidation = new Date();
    entity.validePar = { id: adminId } as any;
    const saved = await this.repository.save(entity);
    await this.postSystemMessage(saved, `❌ ${saved.type === TransactionType.DEPOT ? 'Dépôt' : 'Retrait'} refusé.\nMotif : ${dto.motif}`);
    await this.notifyStatusChange(saved);
    return saved;
  }

  async update(id: string, payload: UpdateTransactionDto, adminId: number) {
    const entity = await this.findById(id);
    const previousStatus = entity.statut;
    const statusChanged = payload.statut !== undefined && payload.statut !== previousStatus;
    if (statusChanged && [TransactionStatus.VALIDEE, TransactionStatus.REJETEE, TransactionStatus.ANNULEE].includes(previousStatus)) {
      throw new BadRequestException('Une transaction terminÃ©e ne peut plus changer d\u2019Ã©tape');
    }
    if (payload.statut === TransactionStatus.REJETEE && !payload.motifRejet?.trim() && !entity.motifRejet?.trim()) {
      throw new BadRequestException('Un motif est requis pour refuser la transaction');
    }
    Object.assign(entity, payload);
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

  private transactionStatusMessage(transaction: Transaction): string {
    if (transaction.statut === TransactionStatus.EN_ATTENTE_ADMIN && transaction.type === TransactionType.DEPOT) {
      return 'Paiement détecté et vérifié. Un administrateur doit encore confirmer le crédit.';
    }
    const label = transaction.type === TransactionType.DEPOT ? 'DÃ©pÃ´t' : 'Retrait';
    switch (transaction.statut) {
      case TransactionStatus.EN_ATTENTE_AUTO: return `${label} en attente du paiement.`;
      case TransactionStatus.EN_VERIFICATION: return `${label} en cours de vÃ©rification.`;
      case TransactionStatus.EN_ATTENTE_PREUVE: return `Une preuve de paiement est requise pour le ${label.toLowerCase()}.`;
      case TransactionStatus.EN_ATTENTE_ADMIN: return `Le ${label.toLowerCase()} est en attente de validation par un administrateur.`;
      case TransactionStatus.VALIDEE: return `${label} validÃ© par un administrateur.`;
      case TransactionStatus.REJETEE: return `${label} refusÃ©.\nMotif : ${transaction.motifRejet ?? ''}`;
      case TransactionStatus.ANNULEE: return `${label} annulÃ©.`;
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
    try {
      const clientDevices = await this.pushDeviceService.findActiveByUser(transaction.user.id);
      const clientTokens = clientDevices.map((device) => device.token);
      const adminTokens = await this.userService.getAdminPushTokens();
      const body = this.statusMessage(transaction.statut, transaction.type);
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
      if (clientTokens.length) await this.pushNotificationService.sendToTokens(clientTokens, 'MatiStore', body, data);
      if (adminTokens.length) {
        await this.pushNotificationService.sendToTokens(
          adminTokens,
          'MatiStore',
          `Transaction ${transaction.user.nom ?? ''} : ${body}`,
          data,
        );
      }
    } catch (error) {
      this.logger.error('Échec de la notification de changement de statut', error);
    }
  }

  private statusMessage(statut: TransactionStatus, type: TransactionType): string {
    if (statut === TransactionStatus.EN_ATTENTE_ADMIN && type === TransactionType.DEPOT) {
      return 'Le paiement de votre dépôt est vérifié. Un administrateur va finaliser le crédit de votre compte.';
    }
    if (statut === TransactionStatus.EN_ATTENTE_ADMIN && type === TransactionType.RETRAIT) {
      return 'Demande de retrait reçue. Elle sera traitée manuellement par MatiStore.';
    }
    if (statut === TransactionStatus.EN_ATTENTE_AUTO && type === TransactionType.DEPOT) {
      return 'Demande de dépôt reçue. Suivez les étapes pour effectuer le paiement.';
    }
    const label = type === TransactionType.DEPOT ? 'dépôt' : 'retrait';
    switch (statut) {
      case TransactionStatus.VALIDEE: return `Votre ${label} a été validé ✅`;
      case TransactionStatus.REJETEE: return `Votre ${label} a été refusé`;
      case TransactionStatus.EN_ATTENTE_PREUVE: return `Merci de joindre une preuve de paiement pour votre ${label}`;
      case TransactionStatus.EN_ATTENTE_ADMIN: return `Votre preuve de ${label} est en cours de vérification`;
      case TransactionStatus.EN_VERIFICATION: return `Vérification de votre ${label} en cours`;
      default: return `Mise à jour de votre ${label}`;
    }
  }
}
