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
