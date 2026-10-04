import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';

@Injectable()
export class TransactionRepository extends Repository<Transaction> {
  constructor(@InjectDataSource() dataSource: DataSource) { super(Transaction, dataSource.createEntityManager()); }
  findByTrackingId(trackingId: string) { return this.findOne({ where: { trackingId }, relations: { user: true, validePar: true } }); }
  findByUser(userId: number) { return this.find({ where: { user: { id: userId } }, relations: { user: true, validePar: true }, order: { createdAt: 'DESC' } }); }
  findByConfirmedReference(referencePaiement: string) {
    return this.findOne({ where: { referencePaiement } });
  }

  findOpenCandidates(operateur: string, montant: number, since: Date) {
    return this.createQueryBuilder('t')
      .innerJoinAndSelect('t.user', 'user')
      .where('LOWER(t.operateur) = LOWER(:operateur)', { operateur })
      .andWhere('t.type = :type', { type: TransactionType.DEPOT })
      .andWhere('t.montant = :montant', { montant })
      .andWhere('t.statut IN (:...statuts)', {
          statuts: [
            TransactionStatus.EN_ATTENTE_AUTO,
            TransactionStatus.EN_VERIFICATION,
            TransactionStatus.EN_ATTENTE_PREUVE,
          ],
      })
      .andWhere('t.createdAt >= :since', { since })
      .orderBy('t.createdAt', 'ASC')
      .getMany();
  }

  findStaleAutoWaiting(autoWaitingBefore: Date, referenceWaitingBefore: Date) {
    return this.createQueryBuilder('t')
      .where('t.type = :type', { type: TransactionType.DEPOT })
      .andWhere(new Brackets((query) => query
        .where('t.statut = :autoStatus AND t.createdAt < :autoWaitingBefore', {
          autoStatus: TransactionStatus.EN_ATTENTE_AUTO,
          autoWaitingBefore,
        })
        .orWhere('t.statut = :referenceStatus AND t.createdAt < :referenceWaitingBefore', {
          referenceStatus: TransactionStatus.EN_VERIFICATION,
          referenceWaitingBefore,
        }),
      ))
      .getMany();
  }
}
