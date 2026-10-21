import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from '../message/message.service';
import { MessageGateway } from '../message/message.gatway';
import { OperateurService } from '../operateur/operateur.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { PushDeviceService } from '../push-device/push-device.service';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import { DiscussionService } from '../discussion/discussion.service';
import { Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';
import { TransactionRepository } from './transaction.repository';
import { TransactionService } from './transaction.service';
import { ServculService } from '../servcul/servcul.service';
import { AppNotificationService } from '../app-notification/app-notification.service';
import { AdminCaptureAvailabilityService } from './admin-capture-availability.service';

describe('TransactionService automatic deposit verification', () => {
  let moduleRef: TestingModule;
  let service: TransactionService;
  let repository: {
    create: jest.Mock;
    createDepositIfNoOpen: jest.Mock;
    save: jest.Mock;
    findByTrackingId: jest.Mock;
    findByConfirmedReference: jest.Mock;
    findOpenCandidates: jest.Mock;
    requireCaptureReconciliation: jest.Mock;
    findStaleAutoWaiting: jest.Mock;
    markDepositAsVerified: jest.Mock;
    cancelPendingDeposit: jest.Mock;
    validateAdminTransaction: jest.Mock;
    rejectExpiredDeposit: jest.Mock;
  };
  let operatorService: { findByNom: jest.Mock };
  let servculService: { findPlayer: jest.Mock; addPlayerDeposit: jest.Mock };
  let userService: { findUserById: jest.Mock; getAdminPushTokens: jest.Mock };

  const operator = {
    nom: 'TMoney',
    active: true,
    notification_name: 'MATI STORE',
    notificationTitleAdmin: 'TMoney Paiement',
    notificationPackageAdmin: 'com.android.messaging',
    notificationPatternAdmin: 'Paiement de\\s+(?<montant>[\\d\\s]+)\\s+FCFA(?: effectué par\\s+(?<telephone>\\d+))?[\\s\\S]*?Ref\\s*:\\s*(?<reference>\\d+)',
  };
  const notificationPostedAt = Date.now() + 60_000;

  const pendingDeposit = () => Object.assign(new Transaction(), {
    trackingId: 'deposit-1',
    user: { id: 7, trackingId: 'user-7' },
    type: TransactionType.DEPOT,
    statut: TransactionStatus.EN_ATTENTE_AUTO,
    montant: 1000,
    operateur: 'TMoney',
    numeroTelephone: '+22890000000',
    compteDestinataire: '123456789',
    discussionTrackingId: 'discussion-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const verifiedDeposit = (deposit: Transaction) => Object.assign(new Transaction(), deposit, {
    statut: TransactionStatus.EN_ATTENTE_ADMIN,
    referencePaiement: '123456',
    notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
  });

  const setupAutoCredit = (verified: Transaction) => {
    repository.validateAdminTransaction.mockImplementation(async (
      _trackingId: string,
      _adminId: number,
      beforeValidation: (transaction: Transaction) => Promise<void>,
    ) => {
      await beforeValidation(verified);
      return Object.assign(new Transaction(), verified, { statut: TransactionStatus.VALIDEE });
    });
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((transaction) => transaction),
      createDepositIfNoOpen: jest.fn(async (_userId, transactionData) => ({
        transaction: Object.assign(new Transaction(), transactionData, { trackingId: 'created-1' }),
        existing: null,
        expired: [],
      })),
      save: jest.fn(async (transaction) => Object.assign(new Transaction(), transaction, { trackingId: 'created-1' })),
      findByTrackingId: jest.fn(),
      findByConfirmedReference: jest.fn().mockResolvedValue(null),
      findOpenCandidates: jest.fn(),
      requireCaptureReconciliation: jest.fn().mockResolvedValue(undefined),
      findStaleAutoWaiting: jest.fn().mockResolvedValue([]),
      markDepositAsVerified: jest.fn(),
      cancelPendingDeposit: jest.fn(),
      validateAdminTransaction: jest.fn(),
      rejectExpiredDeposit: jest.fn(),
    };
    operatorService = { findByNom: jest.fn().mockResolvedValue(operator) };
    servculService = {
      findPlayer: jest.fn().mockResolvedValue({ userId: 123456789, name: 'Test Player', currencyId: 1 }),
      addPlayerDeposit: jest.fn().mockResolvedValue({ success: true }),
    };
    userService = {
      getAdminPushTokens: jest.fn().mockResolvedValue([]),
      findUserById: jest.fn().mockResolvedValue({ id: 99, role: 'ADMIN', active: true }),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: TransactionRepository, useValue: repository },
        { provide: MessageGateway, useValue: { emitTransactionStatusChanged: jest.fn() } },
        { provide: MessageService, useValue: { create: jest.fn().mockResolvedValue({}) } },
        { provide: DiscussionService, useValue: {
          getDepotRetraitDiscussion: jest.fn().mockResolvedValue({ trackingId: 'discussion-1' }),
        } },
        { provide: PushDeviceService, useValue: { findActiveByUser: jest.fn().mockResolvedValue([]) } },
        { provide: PushNotificationService, useValue: { sendToTokens: jest.fn().mockResolvedValue(undefined) } },
        { provide: UtilisateurService, useValue: userService },
        { provide: OperateurService, useValue: operatorService },
        { provide: ServculService, useValue: servculService },
        { provide: AppNotificationService, useValue: { createForUser: jest.fn().mockResolvedValue(undefined) } },
        { provide: AdminCaptureAvailabilityService, useValue: {
          getStatus: jest.fn().mockResolvedValue({ available: true, deviceAvailable: true, manualOverride: false }),
          getPausedExpirationMs: jest.fn().mockResolvedValue(0),
          heartbeat: jest.fn(),
          setManualOverride: jest.fn(),
        } },
      ],
    }).compile();
    service = moduleRef.get(TransactionService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('rejects a deposit when Servcul cannot verify the player', async () => {
    servculService.findPlayer.mockResolvedValue(null);

    await expect(service.create({
      type: TransactionType.DEPOT,
      montant: 1000,
      operateur: 'TMoney',
      numeroTelephone: '+22890000000',
      compteDestinataire: '123456789',
    }, 7)).rejects.toThrow('ID 1XBET introuvable');

    expect(servculService.findPlayer).toHaveBeenCalledWith(123456789);
    expect(repository.createDepositIfNoOpen).not.toHaveBeenCalled();
  });

  it('rejects a second deposit while the client has an open deposit', async () => {
    repository.createDepositIfNoOpen.mockResolvedValue({
      transaction: null,
      existing: pendingDeposit(),
      expired: [],
    });

    await expect(service.create({
      type: TransactionType.DEPOT,
      montant: 1000,
      operateur: 'TMoney',
      numeroTelephone: '+22890000000',
      compteDestinataire: '123456789',
    }, 7)).rejects.toThrow('Un dépôt est déjà en cours');

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows a client to cancel an unverified deposit', async () => {
    const deposit = pendingDeposit();
    const cancelled = Object.assign(new Transaction(), deposit, { statut: TransactionStatus.ANNULEE });
    repository.findByTrackingId.mockResolvedValue(deposit);
    repository.cancelPendingDeposit.mockResolvedValue(cancelled);

    const result = await service.cancel('deposit-1', 7);

    expect(repository.cancelPendingDeposit).toHaveBeenCalledWith('deposit-1', 7);
    expect(result.statut).toBe(TransactionStatus.ANNULEE);
  });

  it('does not allow cancelling a deposit after its payment is verified', async () => {
    repository.findByTrackingId.mockResolvedValue(verifiedDeposit(pendingDeposit()));

    await expect(service.cancel('deposit-1', 7)).rejects.toThrow(
      'Ce dépôt a déjà été vérifié ou ne peut plus être annulé',
    );
    expect(repository.cancelPendingDeposit).toHaveBeenCalledWith('deposit-1', 7);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('still requires Servcul to recognize a withdrawal account ID', async () => {
    servculService.findPlayer.mockResolvedValue(null);

    await expect(service.create({
      type: TransactionType.RETRAIT,
      montant: 1000,
      operateur: 'TMoney',
      numeroTelephone: '+22890000000',
      compteDestinataire: '123456789',
    }, 7)).rejects.toThrow('ID 1XBET introuvable');
  });

  it('matches an admin notification and automatically credits the verified deposit', async () => {
    const deposit = pendingDeposit();
    const verified = verifiedDeposit(deposit);
    repository.findOpenCandidates.mockResolvedValue([deposit]);
    repository.markDepositAsVerified.mockResolvedValue(verified);
    setupAutoCredit(verified);
    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: true,
      retryable: false,
      transactionId: 'deposit-1',
      creditSucceeded: true,
      reason: 'Paiement vérifié et crédit Servcul confirmé.',
      extracted: { montant: 1000, reference: '123456', telephone: '22890000000' },
    }));
    expect(repository.markDepositAsVerified).toHaveBeenCalledWith(
      'deposit-1',
      '123456',
      expect.stringContaining('22890000000'),
    );
    expect(verified.statut).toBe(TransactionStatus.EN_ATTENTE_ADMIN);
    expect(servculService.addPlayerDeposit).toHaveBeenCalledWith(123456789, {
      lng: 'ru',
      summa: 1000,
    });
  });

  it('rejects a notification reference already attached to a transaction with a clear message', async () => {
    repository.findByConfirmedReference.mockResolvedValue(pendingDeposit());

    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: false,
      retryable: false,
      message: 'Cette transaction a déjà été enregistrée.',
      reason: 'La référence de paiement est déjà enregistrée.',
      extracted: { montant: 1000, reference: '123456', telephone: '22890000000' },
    }));
    expect(repository.findOpenCandidates).not.toHaveBeenCalled();
    expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
  });

  it('does not match an admin notification from a different package', async () => {
    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.untrusted.app',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: false,
      retryable: false,
      reason: 'Package reçu "com.untrusted.app" différent du package configuré "com.android.messaging".',
    }));
    expect(repository.findOpenCandidates).not.toHaveBeenCalled();
  });

  it('does not match an admin notification with a different title', async () => {
    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'Notification falsifiée',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: false,
      retryable: false,
      reason: 'Titre reçu "Notification falsifiée" différent du titre configuré "TMoney Paiement".',
    }));
    expect(repository.findOpenCandidates).not.toHaveBeenCalled();
  });

  it('matches an admin notification without checking the merchant name', async () => {
    const deposit = pendingDeposit();
    const verified = verifiedDeposit(deposit);
    repository.findOpenCandidates.mockResolvedValue([deposit]);
    repository.markDepositAsVerified.mockResolvedValue(verified);
    setupAutoCredit(verified);

    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: true,
      retryable: false,
      transactionId: 'deposit-1',
      extracted: { montant: 1000, reference: '123456', telephone: '22890000000' },
    }));
    expect(repository.markDepositAsVerified).toHaveBeenCalledWith(
      'deposit-1',
      '123456',
      expect.stringContaining('Ref: 123456'),
    );
  });

  it('skips package and title checks when they are not configured', async () => {
    operatorService.findByNom.mockResolvedValue({
      ...operator,
      notificationPackageAdmin: '',
      notificationTitleAdmin: '',
    });
    repository.findOpenCandidates.mockResolvedValue([]);

    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: false,
      retryable: true,
      reason: 'Aucune transaction en attente ne correspond à cet opérateur, montant et numéro.',
      extracted: { montant: 1000, reference: '123456', telephone: '22890000000' },
    }));
    expect(repository.findOpenCandidates).toHaveBeenCalled();
  });

  it('refuses admin capture when the actor is not an active administrator', async () => {
    userService.findUserById.mockResolvedValue({ id: 99, role: 'USER', active: true });

    await expect(service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99)).rejects.toThrow('Seul un administrateur actif peut valider une transaction');

    expect(repository.findOpenCandidates).not.toHaveBeenCalled();
  });

  it('selects the most recently created matching deposit when multiple candidates exist', async () => {
    const older = Object.assign(pendingDeposit(), {
      trackingId: 'deposit-older',
      createdAt: new Date('2026-10-09T17:00:30.000Z'),
    });
    const newer = Object.assign(pendingDeposit(), {
      trackingId: 'deposit-newer',
      createdAt: new Date('2026-10-09T17:01:00.000Z'),
    });
    repository.findOpenCandidates.mockResolvedValue([newer, older]);
    const verified = verifiedDeposit(newer);
    repository.markDepositAsVerified.mockResolvedValue(verified);
    setupAutoCredit(verified);

    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      notificationPostedAt: new Date('2026-10-09T17:01:30.000Z').getTime(),
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: true,
      retryable: false,
      transactionId: 'deposit-newer',
      transactionSelection: 'most_recent',
    }));
    expect(repository.markDepositAsVerified).toHaveBeenCalledWith(
      'deposit-newer',
      '123456',
      expect.stringContaining('Ref: 123456'),
    );
  });

  it('credits the fresh deposit when the same client also has an old deposit awaiting reconciliation', async () => {
    const notificationTime = new Date('2026-10-21T14:02:30.000Z').getTime();
    const oldFlagged = Object.assign(pendingDeposit(), {
      trackingId: 'deposit-old',
      createdAt: new Date('2026-10-21T13:56:00.000Z'),
      captureReconciliationRequired: true,
    });
    const fresh = Object.assign(pendingDeposit(), {
      trackingId: 'deposit-fresh',
      createdAt: new Date('2026-10-21T14:02:00.000Z'),
    });
    repository.findOpenCandidates.mockResolvedValue([oldFlagged, fresh]);
    // Stop right after selection: this test only checks which deposit receives the notification.
    repository.markDepositAsVerified.mockResolvedValue(null);

    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      notificationPostedAt: notificationTime,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(repository.markDepositAsVerified).toHaveBeenCalledWith('deposit-fresh', '123456', expect.any(String));
    expect(repository.requireCaptureReconciliation).not.toHaveBeenCalled();
    expect(result).not.toEqual(expect.objectContaining({ transactionSelection: 'manual_reconciliation' }));
  });

  it('asks an administrator when fresh matching deposits belong to different clients', async () => {
    const notificationTime = new Date('2026-10-21T14:02:30.000Z').getTime();
    const first = Object.assign(pendingDeposit(), { trackingId: 'deposit-a', createdAt: new Date('2026-10-21T14:00:00.000Z') });
    const second = Object.assign(pendingDeposit(), {
      trackingId: 'deposit-b',
      user: { id: 8, trackingId: 'user-8' },
      createdAt: new Date('2026-10-21T14:01:00.000Z'),
    });
    repository.findOpenCandidates.mockResolvedValue([first, second]);

    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      notificationPostedAt: notificationTime,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(result).toEqual(expect.objectContaining({ matched: false, transactionSelection: 'manual_reconciliation' }));
    expect(repository.requireCaptureReconciliation).toHaveBeenCalledWith(['deposit-a', 'deposit-b']);
    expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
  });

  it('does not match an old payment notification to a deposit created afterward', async () => {
    const notificationTime = new Date('2026-10-09T17:01:30.000Z').getTime();
    const laterDeposit = Object.assign(pendingDeposit(), {
      createdAt: new Date(notificationTime + 1_000),
    });
    repository.findOpenCandidates.mockResolvedValue([laterDeposit]);

    const result = await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      notificationPostedAt: notificationTime,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(result).toEqual(expect.objectContaining({
      matched: false,
      retryable: true,
      reason: 'Aucune transaction en attente ne correspond à cet opérateur, montant et numéro.',
    }));
    expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
  });

  it('rejects a deposit after the verification timeout', async () => {
    const deposit = pendingDeposit();
    const rejected = Object.assign(deposit, {
      statut: TransactionStatus.REJETEE,
      motifRejet: 'Aucune notification de paiement valide reçue.',
    });
    repository.findStaleAutoWaiting.mockResolvedValue([deposit]);
    repository.rejectExpiredDeposit.mockResolvedValue(rejected);

    await service.timeoutStaleTransactions();

    expect(repository.rejectExpiredDeposit).toHaveBeenCalledWith(
      'deposit-1',
      expect.any(Date),
      'Aucune notification de paiement valide reçue.',
    );
  });

  it('credits Servcul only when an administrator manually validates the verified deposit', async () => {
    const deposit = Object.assign(pendingDeposit(), {
      statut: TransactionStatus.EN_ATTENTE_ADMIN,
      referencePaiement: '123456',
    });
    repository.validateAdminTransaction.mockImplementation(async (
      _trackingId: string,
      _adminId: number,
      beforeValidation: (transaction: Transaction) => Promise<void>,
    ) => {
      await beforeValidation(deposit);
      return Object.assign(new Transaction(), deposit, {
        statut: TransactionStatus.VALIDEE,
      });
    });

    const result = await service.validateManually('deposit-1', 99);

    expect(result.statut).toBe(TransactionStatus.VALIDEE);
    expect(servculService.addPlayerDeposit).toHaveBeenCalledWith(123456789, {
      lng: 'ru',
      summa: 1000,
    });
  });

  it('does not validate a manually verified deposit when Servcul rejects its credit', async () => {
    const deposit = pendingDeposit();
    deposit.statut = TransactionStatus.EN_ATTENTE_ADMIN;
    repository.validateAdminTransaction.mockImplementation(async (
      _trackingId: string,
      _adminId: number,
      beforeValidation: (transaction: Transaction) => Promise<void>,
    ) => {
      await beforeValidation(deposit);
      return Object.assign(new Transaction(), deposit, { statut: TransactionStatus.VALIDEE });
    });
    servculService.addPlayerDeposit.mockRejectedValue(new Error('Servcul unavailable'));

    await expect(service.validateManually('deposit-1', 99)).rejects.toThrow('Servcul unavailable');

    expect(repository.validateAdminTransaction).toHaveBeenCalledWith(
      'deposit-1',
      99,
      expect.any(Function),
    );
  });
});
