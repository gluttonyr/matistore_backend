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
});
