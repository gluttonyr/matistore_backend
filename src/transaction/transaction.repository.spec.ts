import { TransactionRepository } from './transaction.repository';
import { Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';

describe('TransactionRepository.markDepositAsVerified', () => {
  let row: Partial<Transaction>;
  let save: jest.Mock;
  let repo: TransactionRepository;

  beforeEach(() => {
    save = jest.fn(async (x) => x);
    const manager: any = {
      getRepository: () => ({ findOne: async () => row, save }),
      transaction: (cb: any) => cb(manager),
    };
    repo = new TransactionRepository({ createEntityManager: () => manager } as any);
    row = { type: TransactionType.DEPOT, statut: TransactionStatus.EN_VERIFICATION, referencePaiement: 'R1' };
  });

  it('refuses to overwrite a different recorded reference', async () => {
    expect(await repo.markDepositAsVerified('t', 'R2', 'n')).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(row.referencePaiement).toBe('R1');
  });

  it('accepts the same reference again (idempotent)', async () => {
    expect(await repo.markDepositAsVerified('t', 'R1', 'n')).toBe(row);
    expect(save).toHaveBeenCalled();
  });

  // A rejected or cancelled deposit is final: an admin may already have credited it by hand.
  it.each([TransactionStatus.REJETEE, TransactionStatus.ANNULEE])('never reopens a %s deposit, even without a reference', async (statut) => {
    row = { type: TransactionType.DEPOT, statut };
    expect(await repo.markDepositAsVerified('t', 'R9', 'n')).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(row.statut).toBe(statut);
  });
});

describe('TransactionRepository.findAdminPage filters', () => {
  const run = async (filters: any) => {
    const query: any = {
      addSelect: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(), addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => []), getCount: jest.fn(async () => 0),
    };
    query.clone = () => query;
    const repo: any = new TransactionRepository({ createEntityManager: () => ({}) } as any);
    repo.pageQuery = () => query;
    repo.count = jest.fn(async () => 0);
    await repo.findAdminPage(1, 25, filters);
    return query.andWhere.mock.calls.map((c: any[]) => c[0]);
  };

  it('adds no extra condition when the new filters are absent', async () => {
    expect(await run({})).toEqual([]);
  });

  it('filters on reconciliation and open statuses', async () => {
    const where = await run({ captureReconciliation: true, open: true });
    expect(where).toEqual([
      'transaction.captureReconciliationRequired = true',
      'transaction.statut IN (:...openStatuses)',
    ]);
  });
});
