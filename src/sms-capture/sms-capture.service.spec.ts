import { SmsCaptureService } from './sms-capture.service';
import { SmsAttributionOrigin, SmsCaptureStatus } from './entities/sms-capture.entity';
import { smsFingerprint } from './sms-fingerprint';

describe('SmsCaptureService.ingestBatch', () => {
  const op = { nom: 'Mixx', notificationTitleAdmin: 'MIXX Togo', active: true };
  const sms = (corps = 'Paiement 1000', expediteur = 'MIXX Togo') => ({ expediteur, corps, receivedAt: 1_700_000_000_000 });
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let tx: { processAdminCapture: jest.Mock; extractCaptureFields: jest.Mock; findByPaymentReference: jest.Mock };
  let operateurs: { findAll: jest.Mock };
  let service: SmsCaptureService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ trackingId: 't-' + x.fingerprint.slice(0, 4), ...x })),
    };
    tx = {
      processAdminCapture: jest.fn().mockResolvedValue({ matched: false, retryable: false, reason: 'r' }),
      extractCaptureFields: jest.fn().mockReturnValue({ montant: 1000, reference: 'R1', telephone: '9000' }),
      findByPaymentReference: jest.fn(),
    };
    operateurs = { findAll: jest.fn().mockResolvedValue([op]) };
    service = new SmsCaptureService(repo as any, tx as any, operateurs as any);
  });

  it('a duplicate fingerprint returns the stored row without calling processAdminCapture', async () => {
    repo.findOne.mockResolvedValue({ trackingId: 'old', statut: SmsCaptureStatus.ATTRIBUE, transaction: { trackingId: 'tx' }, motif: null });
    const [r] = await service.ingestBatch(1, 'd', [sms()]);
    expect(r).toMatchObject({ trackingId: 'old', statut: SmsCaptureStatus.ATTRIBUE, transactionId: 'tx' });
    expect(tx.processAdminCapture).not.toHaveBeenCalled();
  });

  it('unknown sender is IGNORE', async () => {
    const [r] = await service.ingestBatch(1, 'd', [sms('x', 'Inconnu')]);
    expect(r).toMatchObject({ statut: SmsCaptureStatus.IGNORE, motif: 'Expéditeur inconnu' });
  });

  it('sender matching ignores case and surrounding spaces', async () => {
    await service.ingestBatch(1, 'd', [sms('x', ' mixx togo ')]);
    expect(tx.processAdminCapture).toHaveBeenCalled();
    expect(tx.extractCaptureFields).toHaveBeenCalledWith(op, 'x');
  });

  it('non matching text is IGNORE', async () => {
    tx.extractCaptureFields.mockReturnValue(null);
    const [r] = await service.ingestBatch(1, 'd', [sms()]);
    expect(r.statut).toBe(SmsCaptureStatus.IGNORE);
    expect(r.motif).toBe('Le texte ne correspond pas au modèle de notification configuré');
  });

  it('matched result is ATTRIBUE AUTO_MATI_PAY and passes the 24h options', async () => {
    tx.processAdminCapture.mockResolvedValue({ matched: true, retryable: false, transactionId: 'tx1' });
    const [r] = await service.ingestBatch(7, 'd', [sms()]);
    expect(r).toMatchObject({ statut: SmsCaptureStatus.ATTRIBUE, transactionId: 'tx1' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ origineAttribution: SmsAttributionOrigin.AUTO_MATI_PAY, montant: 1000, reference: 'R1' }));
    expect(tx.processAdminCapture).toHaveBeenCalledWith(
      expect.objectContaining({ operateur: 'Mixx', montant: 1000, numeroTelephoneClient: '9000', notificationPostedAt: 1_700_000_000_000 }),
      7,
      { skipPackageCheck: true, candidateWindowMs: 24 * 3600_000, includeAutoRejected: true },
    );
  });

  it('duplicateReference links the MatiStore transaction as MATISTORE', async () => {
    tx.processAdminCapture.mockResolvedValue({ matched: false, retryable: false, duplicateReference: true });
    tx.findByPaymentReference.mockResolvedValue({ trackingId: 'ms1' });
    const [r] = await service.ingestBatch(1, 'd', [sms()]);
    expect(r).toMatchObject({ statut: SmsCaptureStatus.ATTRIBUE, transactionId: 'ms1' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ origineAttribution: SmsAttributionOrigin.MATISTORE }));
    expect(tx.findByPaymentReference).toHaveBeenCalledWith('R1');
  });

  it('manual_reconciliation is A_RAPPROCHER', async () => {
    tx.processAdminCapture.mockResolvedValue({ matched: false, retryable: false, transactionSelection: 'manual_reconciliation' });
    const [r] = await service.ingestBatch(1, 'd', [sms()]);
    expect(r.statut).toBe(SmsCaptureStatus.A_RAPPROCHER);
  });

  it('no match is SANS_TRANSACTION with motif', async () => {
    const [r] = await service.ingestBatch(1, 'd', [sms()]);
    expect(r).toMatchObject({ statut: SmsCaptureStatus.SANS_TRANSACTION, motif: 'r' });
  });

  it('a concurrent insert (23505) returns the existing row', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ trackingId: 'won', statut: SmsCaptureStatus.ATTRIBUE, transaction: null });
    repo.save.mockRejectedValue({ driverError: { code: '23505' } });
    const [r] = await service.ingestBatch(1, 'd', [sms()]);
    expect(r.trackingId).toBe('won');
  });

  it('one failing SMS does not stop the batch', async () => {
    tx.processAdminCapture
      .mockResolvedValueOnce({ matched: false, retryable: false })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ matched: false, retryable: false });
    const res = await service.ingestBatch(1, 'd', [sms('a'), sms('b'), sms('c')]);
    expect(res).toHaveLength(3);
    expect(res[0].error).toBeUndefined();
    expect(res[1]).toMatchObject({ error: 'boom', fingerprint: smsFingerprint('MIXX Togo', 1_700_000_000_000, 'b') });
    expect(res[2].error).toBeUndefined();
  });
  it('a null item yields an error for that item only', async () => {
    const res = await service.ingestBatch(1, 'd', [sms('a'), null as any, sms('c')]);
    expect(res).toHaveLength(3);
    expect(res[1].error).toBeDefined();
    expect(res[0].error).toBeUndefined();
    expect(res[2].error).toBeUndefined();
  });
});

describe('SmsCaptureService consultation', () => {
  let qb: any;
  let repo: any;
  let tx: any;
  let service: SmsCaptureService;
  const txRow = { trackingId: 'T1', montant: 5000, operateur: 'Mixx', createdAt: new Date('2026-01-01T10:00:00Z') };

  beforeEach(() => {
    qb = {};
    for (const m of ['leftJoinAndSelect', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take', 'limit', 'setParameters']) qb[m] = jest.fn().mockReturnValue(qb);
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    qb.getMany = jest.fn().mockResolvedValue([]);
    repo = { createQueryBuilder: jest.fn().mockReturnValue(qb), count: jest.fn() };
    tx = { findById: jest.fn().mockResolvedValue(txRow) };
    service = new SmsCaptureService(repo, tx, {} as any);
  });

  it('candidates exclude ATTRIBUE and other amounts and are ordered by date proximity', async () => {
    await service.candidates('T1');
    const wheres = qb.andWhere.mock.calls.map((c: any[]) => c[0]).join(' ');
    expect(wheres).toContain('sms.statut != :attribue');
    expect(wheres).toContain('sms.montant = :montant');
    expect(wheres).toContain('LOWER(sms.operateur) = LOWER(:operateur)');
    expect(qb.andWhere.mock.calls.map((c: any[]) => c[1]).reduce((a: any, b: any) => ({ ...a, ...b }), {}))
      .toMatchObject({ attribue: SmsCaptureStatus.ATTRIBUE, montant: 5000, operateur: 'Mixx' });
    expect(qb.orderBy.mock.calls[0][0]).toMatch(/ABS\(EXTRACT\(EPOCH FROM \(sms\.receivedAt - :txDate\)\)\)/);
    expect(qb.limit).toHaveBeenCalledWith(50);
  });

  it('search with a number also matches the amount', async () => {
    await service.list({ page: 1, limit: 20, search: '5_00' });
    expect(qb.andWhere.mock.calls.at(-1)[0]).not.toContain('sms.montant = :montant');
    expect(qb.andWhere.mock.calls.at(-1)[1].search).toBe('%5\\_00%');
    qb.andWhere.mockClear();
    repo.count.mockResolvedValue(0);
    await service.list({ page: 1, limit: 20, search: '5000' });
    expect(qb.andWhere.mock.calls.at(-1)[0]).toContain('sms.montant = :montant');
    expect(qb.andWhere.mock.calls.at(-1)[1].montant).toBe(5000);
  });

  it('counts return SANS_TRANSACTION and A_RAPPROCHER totals', async () => {
    repo.count.mockImplementation(async ({ where }: any) => (where.statut === SmsCaptureStatus.SANS_TRANSACTION ? 3 : 2));
    qb.getManyAndCount.mockResolvedValue([[], 9]);
    const r = await service.list({ page: 2, limit: 5 });
    expect(r).toMatchObject({ items: [], total: 9, counts: { SANS_TRANSACTION: 3, A_RAPPROCHER: 2 } });
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.orderBy).toHaveBeenCalledWith('sms.receivedAt', 'DESC');
  });
});

describe('SmsCaptureService.assign', () => {
  let row: any;
  let smsRepo: { findOne: jest.Mock; save: jest.Mock };
  let tx: { assignSmsManually: jest.Mock };
  let service: SmsCaptureService;
  const dto = { transactionId: 'tx1', confirmPhoneMismatch: false };

  beforeEach(() => {
    row = { trackingId: 's1', statut: SmsCaptureStatus.SANS_TRANSACTION, reference: 'R1', corps: 'c', montant: 1000, telephone: '9000' };
    smsRepo = { findOne: jest.fn(async () => row), save: jest.fn(async (x) => x) };
    tx = { assignSmsManually: jest.fn().mockResolvedValue({ transactionId: 'tx1', creditSucceeded: true }) };
    const repo = { manager: { transaction: (cb: any) => cb({ getRepository: () => smsRepo }) } };
    service = new SmsCaptureService(repo as any, tx as any, {} as any);
  });

  it('locks the row, assigns and records the manual attribution', async () => {
    const r = await service.assign('s1', 9, dto);
    expect(smsRepo.findOne).toHaveBeenCalledWith({ where: { trackingId: 's1' }, lock: { mode: 'pessimistic_write' } });
    expect(tx.assignSmsManually).toHaveBeenCalledWith('tx1', { reference: 'R1', corps: 'c', montant: 1000, telephone: '9000' }, 9, false);
    expect(row).toMatchObject({
      statut: SmsCaptureStatus.ATTRIBUE, origineAttribution: SmsAttributionOrigin.MANUEL,
      attribuePar: { id: 9 }, transaction: { trackingId: 'tx1' }, motif: 'Attribué manuellement',
    });
    expect(r).toEqual({ transactionId: 'tx1', creditSucceeded: true });
  });

  it('a second assign of the same SMS is refused with "SMS déjà attribué" and credits once', async () => {
    await service.assign('s1', 9, dto);
    await expect(service.assign('s1', 9, dto)).rejects.toThrow('SMS déjà attribué');
    expect(tx.assignSmsManually).toHaveBeenCalledTimes(1);
  });

  it('leaves the SMS untouched when the assignment is refused', async () => {
    tx.assignSmsManually.mockRejectedValue(new Error('refused'));
    await expect(service.assign('s1', 9, dto)).rejects.toThrow('refused');
    expect(smsRepo.save).not.toHaveBeenCalled();
  });

  it('unknown SMS is a 404', async () => {
    smsRepo.findOne.mockResolvedValue(null);
    await expect(service.assign('s1', 9, dto)).rejects.toThrow('SMS introuvable');
  });
});
