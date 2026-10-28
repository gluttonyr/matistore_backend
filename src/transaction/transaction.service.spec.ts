import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from '../message/message.service';
import { MessageGateway } from '../message/message.gatway';
import { OperateurService } from '../operateur/operateur.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { PushDeviceService } from '../push-device/push-device.service';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import { DiscussionService } from '../discussion/discussion.service';
import { Transaction, TransactionStatus, TransactionType, ValidationMethod } from './entities/transaction.entity';
import { ConflictException } from '@nestjs/common';
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
    findStaleReconciliation: jest.Mock;
    rejectStaleReconciliation: jest.Mock;
    findStaleAutoWaiting: jest.Mock;
    markDepositAsVerified: jest.Mock;
    cancelPendingDeposit: jest.Mock;
    validateAdminTransaction: jest.Mock;
    rejectExpiredDeposit: jest.Mock;
    completeAutomaticTransaction: jest.Mock;
    update: jest.Mock;
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
      findStaleReconciliation: jest.fn().mockResolvedValue([]),
      rejectStaleReconciliation: jest.fn(),
      findStaleAutoWaiting: jest.fn().mockResolvedValue([]),
      markDepositAsVerified: jest.fn(),
      cancelPendingDeposit: jest.fn(),
      validateAdminTransaction: jest.fn(),
      rejectExpiredDeposit: jest.fn(),
      completeAutomaticTransaction: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
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

  it('matches a late notification to the only client whose deposits await reconciliation', async () => {
    const notificationTime = new Date('2026-10-21T14:02:30.000Z').getTime();
    const flagged = Object.assign(pendingDeposit(), {
      trackingId: 'deposit-flagged',
      createdAt: new Date('2026-10-21T13:40:00.000Z'),
      captureReconciliationRequired: true,
    });
    repository.findOpenCandidates.mockResolvedValue([flagged]);
    repository.markDepositAsVerified.mockResolvedValue(null);

    await service.processAdminCapture({
      operateur: 'TMoney',
      montant: 1000,
      notificationPostedAt: notificationTime,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    }, 99);

    expect(repository.markDepositAsVerified).toHaveBeenCalledWith('deposit-flagged', '123456', expect.any(String));
    expect(repository.requireCaptureReconciliation).not.toHaveBeenCalled();
  });

  describe('assignSmsManually', () => {
    const sms = { reference: 'R1', corps: 'body', montant: 1000, telephone: '22890000000' };
    const deposit = (extra: Partial<Transaction> = {}) => Object.assign(pendingDeposit(), extra);
    const assign = (confirm = false, s = sms) => service.assignSmsManually('deposit-1', s, 99, confirm);
    beforeEach(() => {
      repository.findByTrackingId.mockResolvedValue(deposit());
      repository.markDepositAsVerified.mockImplementation(async () => deposit({ statut: TransactionStatus.EN_VERIFICATION }));
      repository.completeAutomaticTransaction.mockResolvedValue(deposit({ statut: TransactionStatus.VALIDEE }));
    });

    it('assigns to an open deposit flagged for reconciliation', async () => {
      repository.findByTrackingId.mockResolvedValue(deposit({ captureReconciliationRequired: true }));
      await expect(assign()).resolves.toEqual({ transactionId: 'deposit-1', creditSucceeded: true });
      expect(repository.markDepositAsVerified).toHaveBeenCalledWith('deposit-1', 'R1', 'body');
      expect(repository.completeAutomaticTransaction).toHaveBeenCalledWith(
        'deposit-1', expect.any(Function), ValidationMethod.ADMIN_MANUEL, [TransactionStatus.EN_VERIFICATION]);
      expect(repository.update).toHaveBeenCalledWith('deposit-1', { validePar: { id: 99 }, captureReconciliationRequired: false });
    });

    it('refuses an auto-rejected deposit (a rejected deposit is final)', async () => {
      repository.findByTrackingId.mockResolvedValue(deposit({ statut: TransactionStatus.REJETEE }));
      await expect(assign()).rejects.toThrow('Cette transaction ne peut pas recevoir ce paiement');
      expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
    });

    it('refuses a deposit rejected by an admin', async () => {
      repository.findByTrackingId.mockResolvedValue(deposit({ statut: TransactionStatus.REJETEE, validePar: { id: 5 } as any }));
      await expect(assign()).rejects.toThrow('Cette transaction ne peut pas recevoir ce paiement');
      expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
    });

    it.each([TransactionStatus.ANNULEE, TransactionStatus.VALIDEE])('refuses %s', async (statut) => {
      repository.findByTrackingId.mockResolvedValue(deposit({ statut }));
      await expect(assign()).rejects.toThrow('Cette transaction ne peut pas recevoir ce paiement');
      expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
    });

    it('refuses when the repository lock finds the deposit no longer eligible', async () => {
      repository.markDepositAsVerified.mockResolvedValue(null);
      await expect(assign()).rejects.toThrow('Cette transaction ne peut pas recevoir ce paiement');
      expect(repository.completeAutomaticTransaction).not.toHaveBeenCalled();
    });

    it('refuses an empty reference', async () => {
      await expect(assign(false, { ...sms, reference: ' ' })).rejects.toThrow('Ce SMS ne contient pas de référence de paiement');
    });

    it('refuses a different amount', async () => {
      await expect(assign(false, { ...sms, montant: 500 }))
        .rejects.toThrow('Le montant du SMS (500) est différent de celui de la transaction (1000)');
      expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
    });

    it('refuses a phone mismatch unless confirmed', async () => {
      const other = { ...sms, telephone: '22891111111' };
      await expect(assign(false, other)).rejects.toMatchObject({
        response: { message: 'Le numéro du SMS est différent de celui de la transaction', code: 'PHONE_MISMATCH' },
      });
      expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
      await expect(assign(true, other)).resolves.toMatchObject({ creditSucceeded: true });
    });

    it('refuses a reference already used and names the transaction', async () => {
      repository.findByConfirmedReference.mockResolvedValue({ trackingId: 'other-tx' });
      await expect(assign()).rejects.toThrow('Cette référence est déjà utilisée par la transaction other-tx');
      expect(repository.markDepositAsVerified).not.toHaveBeenCalled();
    });

    it('maps a unique violation from the database to a conflict', async () => {
      repository.markDepositAsVerified.mockRejectedValue({ driverError: { code: '23505' } });
      await expect(assign()).rejects.toThrow(ConflictException);
    });
  });

  describe('SMS capture options', () => {
    const H = 3600_000;
    const T = new Date('2026-10-21T14:00:00.000Z').getTime();
    const smsAt = T + 5 * 60_000;
    const dto = (postedAt = smsAt) => ({
      operateur: 'TMoney',
      montant: 1000,
      notificationPostedAt: postedAt,
      numeroTelephoneClient: '22890000000',
      notificationBrute: 'MATI STORE Paiement de 1 000 FCFA effectué par 22890000000 Ref: 123456',
      packageNotification: 'com.android.messaging',
      titreNotification: 'TMoney Paiement',
    });
    const smsOptions = { candidateWindowMs: 24 * H, skipPackageCheck: true };
    const deposit = (trackingId: string, createdAt: number, extra: Partial<Transaction> = {}) =>
      Object.assign(pendingDeposit(), { trackingId, createdAt: new Date(createdAt) }, extra);

    beforeEach(() => repository.markDepositAsVerified.mockResolvedValue(null));

    it('sms window: searches open deposits of the last 24h', async () => {
      repository.findOpenCandidates.mockResolvedValue([]);

      await service.processAdminCapture(dto(), 99, smsOptions);

      expect(repository.findOpenCandidates).toHaveBeenCalledWith(
        'TMoney', 1000, new Date(smsAt - 24 * H), new Date(smsAt),
      );
    });

    it('sms window: picks the most recent deposit of the same client created before the SMS', async () => {
      repository.findOpenCandidates.mockResolvedValue([
        deposit('old-rejected', T - 3 * H, { statut: TransactionStatus.REJETEE }),
        deposit('recent-open', T - 60_000),
      ]);

      await service.processAdminCapture(dto(), 99, smsOptions);

      expect(repository.markDepositAsVerified).toHaveBeenCalledWith('recent-open', '123456', expect.any(String));
    });

    it('sms window: a deposit created 24h01 before the SMS is not a candidate; 23h59 is', async () => {
      repository.findOpenCandidates.mockResolvedValue([deposit('too-old', smsAt - 24 * H - 60_000)]);
      const tooOld = await service.processAdminCapture(dto(), 99, smsOptions);
      expect(tooOld.matched).toBe(false);
      expect(repository.markDepositAsVerified).not.toHaveBeenCalled();

      repository.findOpenCandidates.mockResolvedValue([deposit('in-window', smsAt - 24 * H + 60_000)]);
      await service.processAdminCapture(dto(), 99, smsOptions);
      expect(repository.markDepositAsVerified).toHaveBeenCalledWith('in-window', '123456', expect.any(String));
    });

    it('sms window: skips the package check only when asked', async () => {
      repository.findOpenCandidates.mockResolvedValue([]);
      const noPackage = { ...dto(), packageNotification: undefined };

      const skipped = await service.processAdminCapture(noPackage, 99, { skipPackageCheck: true });
      const checked = await service.processAdminCapture(noPackage, 99);

      expect(skipped.reason).not.toContain('Package reçu');
      expect(checked.reason).toContain('Package reçu');
    });

    it('admin-capture without options keeps the 15 min window', async () => {
      repository.findOpenCandidates.mockResolvedValue([]);

      await service.processAdminCapture(dto(), 99);

      expect(repository.findOpenCandidates).toHaveBeenCalledWith(
        'TMoney', 1000, new Date(smsAt - 15 * 60_000), new Date(smsAt),
      );
    });

    it('returns duplicateReference when the reference is already confirmed', async () => {
      repository.findByConfirmedReference.mockResolvedValue(pendingDeposit());

      const result = await service.processAdminCapture(dto(), 99);

      expect(result).toEqual(expect.objectContaining({ matched: false, duplicateReference: true }));
    });
  });

  it('silently rejects deposits awaiting reconciliation for more than 25 hours', async () => {
    const stale = Object.assign(pendingDeposit(), { captureReconciliationRequired: true });
    repository.findStaleReconciliation.mockResolvedValue([stale]);
    repository.rejectStaleReconciliation.mockResolvedValue(Object.assign(new Transaction(), stale, {
      statut: TransactionStatus.REJETEE,
      motifRejet: 'Aucun paiement détecté pour ce dépôt. Si vous avez payé, faites une réclamation.',
    }));

    const before = Date.now();
    await service.timeoutStaleTransactions();

    const cutoff: Date = repository.findStaleReconciliation.mock.calls[0][0];
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(25 * 60 * 60 * 1000);
    expect(before - cutoff.getTime()).toBeLessThan(25 * 60 * 60 * 1000 + 5_000);
    expect(repository.rejectStaleReconciliation).toHaveBeenCalledWith('deposit-1', cutoff, expect.stringContaining('réclamation'));
    expect(moduleRef.get(MessageService).create).not.toHaveBeenCalled();
    expect(moduleRef.get(MessageGateway).emitTransactionStatusChanged).not.toHaveBeenCalled();
    expect(moduleRef.get(PushNotificationService).sendToTokens).not.toHaveBeenCalled();
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

  it('formatted amounts are parsed', () => {
    const operator = { notificationPatternAdmin: 'Paiement de\\s+(?<montant>[\\d\\s,.]+?)\\s+FCFA(?: effectué par\\s+(?<telephone>\\d+))?[\\s\\S]*?Ref\\s*:\\s*(?<reference>\\d+)' };
    expect(service.extractCaptureFields(operator as any, 'Paiement de 7 000 FCFA effectué par 90000000 Ref: 1'))
      .toEqual({ montant: 7000, reference: '1', telephone: '90000000' });
    expect(service.extractCaptureFields(operator as any, 'Paiement de 2 000,00 FCFA Ref: 2')?.montant).toBe(2000);
    expect(service.extractCaptureFields(operator as any, 'Paiement de 1 000.50 FCFA Ref: 3')?.montant).toBe(1000);
    expect(service.extractCaptureFields(operator as any, 'rien')).toBeNull();
  });
});
